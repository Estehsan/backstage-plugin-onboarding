/*
 * Copyright 2026 Estehsan Tariq
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Page,
  Header,
  Content,
  ResponseErrorPanel,
  WarningPanel,
  Progress,
} from '@backstage/core-components';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import { Tabs, TabList, TabPanel, Tab } from '@backstage/ui';
import { onboardingApiRef } from '../../api/OnboardingApi';
import {
  OnboardingProgress,
  OnboardingTemplate,
  TaskStatus,
  TeamJoinerSummary,
} from '../../types';
import { ProgressBar } from '../ProgressBar';
import { TaskList } from '../TaskList';
import { TeamView } from '../TeamView/TeamView';
import { TemplatesView } from '../TemplatesView/TemplatesView';
import { useAutomatedTask } from '../../hooks/useAutomatedTask';

function asError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

// A missing progress record (404 / NotFoundError) is the normal "no checklist
// assigned yet" state rather than a real failure to surface to the user.
function isNotFound(reason: unknown): boolean {
  if (reason instanceof ResponseError) {
    return reason.statusCode === 404;
  }
  const err = asError(reason);
  return (
    err.name === 'NotFoundError' ||
    (err as { cause?: { name?: string } }).cause?.name === 'NotFoundError'
  );
}

/** @public */
export function OnboardingPage() {
  const [tab, setTab] = useState('tasks');
  const onboardingApi = useApi(onboardingApiRef);
  const identityApi = useApi(identityApiRef);

  const [progress, setProgress] = useState<OnboardingProgress | undefined>();
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [isAssigner, setIsAssigner] = useState(false);
  const [myBuddies, setMyBuddies] = useState<TeamJoinerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  // Non-fatal load error surfaced to the user while still rendering the page.
  const [loadWarning, setLoadWarning] = useState<Error | undefined>();
  const [userId, setUserId] = useState<string>('');

  const reloadProgress = useCallback(async () => {
    if (!userId) return;
    try {
      const updated = await onboardingApi.getProgress(userId);
      setProgress(updated);
    } catch {
      // A reload failure should not wipe the currently displayed progress;
      // keep the existing state so the user doesn't lose their checklist.
    }
  }, [onboardingApi, userId]);

  const { triggerAutomatedTask } = useAutomatedTask({
    userId,
    onProgressUpdate: reloadProgress,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const identity = await identityApi.getBackstageIdentity();
        const userEntityRef = identity.userEntityRef;
        setUserId(userEntityRef);

        const [
          progressResult,
          templatesResult,
          isAssignerResult,
          myBuddiesResult,
        ] = await Promise.allSettled([
          onboardingApi.getProgress(userEntityRef),
          onboardingApi.getTemplates(),
          onboardingApi.getIsAssigner(),
          onboardingApi.getMyBuddies(),
        ]);

        if (cancelled) return;

        let progressData: OnboardingProgress | undefined;
        let templateData: OnboardingTemplate[] = [];
        let isAssignerData = false;
        let myBuddiesData: TeamJoinerSummary[] = [];
        const warnings: Error[] = [];

        if (progressResult.status === 'fulfilled') {
          progressData = progressResult.value;
        } else if (!isNotFound(progressResult.reason)) {
          // A missing progress record simply means no checklist has been
          // assigned yet — that is the empty state, not an error.
          warnings.push(asError(progressResult.reason));
        }

        if (templatesResult.status === 'fulfilled') {
          templateData = templatesResult.value;
        } else {
          warnings.push(asError(templatesResult.reason));
        }

        // Permission checks fail closed silently to the user (a denied or
        // unreachable check both simply hide the affected tab), but the
        // rejection reason is still logged so a genuine service outage can
        // be distinguished from "not permitted" during support/on-call
        // investigation.
        if (isAssignerResult.status === 'fulfilled') {
          isAssignerData = isAssignerResult.value.isAssigner;
        } else {
          // eslint-disable-next-line no-console
          console.error(
            'Failed to check assigner permission, defaulting to false:',
            isAssignerResult.reason,
          );
        }

        if (myBuddiesResult.status === 'fulfilled') {
          myBuddiesData = myBuddiesResult.value;
        } else {
          // eslint-disable-next-line no-console
          console.error(
            'Failed to load buddy assignments, defaulting to none:',
            myBuddiesResult.reason,
          );
        }

        setProgress(progressData);
        setTemplates(templateData);
        setIsAssigner(isAssignerData);
        setMyBuddies(myBuddiesData);
        setError(undefined);
        setLoadWarning(warnings[0]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [identityApi, onboardingApi]);

  const currentTemplate = useMemo(
    () => templates.find(t => t.metadata.name === progress?.templateName),
    [templates, progress?.templateName],
  );

  const handleToggle = useCallback(
    async (taskId: string) => {
      if (!progress || !currentTemplate) return;

      const taskProgress = progress.tasks.find(t => t.taskId === taskId);
      const allTasks = currentTemplate.spec.phases.flatMap(p => p.tasks);
      const taskDef = allTasks.find(t => t.id === taskId);

      // If it's an automated task that hasn't been started, trigger via scaffolder
      if (
        taskDef?.type === 'automated' &&
        taskDef.automationRef &&
        taskProgress?.status !== 'done' &&
        taskProgress?.status !== 'in-progress'
      ) {
        await triggerAutomatedTask(taskId, taskDef.automationRef);
        return;
      }

      const newStatus: TaskStatus =
        taskProgress?.status === 'done' ? 'pending' : 'done';

      try {
        const updated = await onboardingApi.updateTaskStatus(
          userId,
          taskId,
          newStatus,
        );
        setProgress(updated);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    },
    [onboardingApi, progress, userId, currentTemplate, triggerAutomatedTask],
  );

  const handleTabChange = useCallback((key: string | number) => {
    setTab(String(key));
  }, []);

  const showTemplatesTab = isAssigner;
  const showTeamViewTab = isAssigner || myBuddies.length > 0;

  if (loading) {
    return (
      <Page themeId="tool">
        <Header
          title="Developer Onboarding"
          subtitle="Your onboarding checklist"
        />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header
          title="Developer Onboarding"
          subtitle="Your onboarding checklist"
        />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  const completedCount =
    progress?.tasks.filter(t => t.status === 'done').length ?? 0;
  const totalCount = progress?.tasks.length ?? 0;

  return (
    <Page themeId="tool">
      <Header
        title="Developer Onboarding"
        subtitle="Your onboarding checklist"
      />
      <Content>
        {loadWarning && (
          <WarningPanel
            title="Some onboarding data could not be loaded"
            message={loadWarning.message}
          />
        )}
        <Tabs selectedKey={tab} onSelectionChange={handleTabChange}>
          <TabList>
            <Tab id="tasks">My Tasks</Tab>
            {showTeamViewTab && <Tab id="team">Team View</Tab>}
            {showTemplatesTab && <Tab id="templates">Templates</Tab>}
          </TabList>

          <TabPanel id="tasks">
            {progress && currentTemplate ? (
              <>
                <ProgressBar completed={completedCount} total={totalCount} />
                <TaskList
                  phases={currentTemplate.spec.phases}
                  progress={progress}
                  onToggle={handleToggle}
                />
              </>
            ) : (
              <div>
                No onboarding checklist assigned yet. Ask your manager to assign
                a template from the Templates tab.
              </div>
            )}
          </TabPanel>

          {showTeamViewTab && (
            <TabPanel id="team">
              <TeamView onboardingApi={onboardingApi} />
            </TabPanel>
          )}

          {showTemplatesTab && (
            <TabPanel id="templates">
              <TemplatesView
                templates={templates}
                onboardingApi={onboardingApi}
              />
            </TabPanel>
          )}
        </Tabs>
      </Content>
    </Page>
  );
}
