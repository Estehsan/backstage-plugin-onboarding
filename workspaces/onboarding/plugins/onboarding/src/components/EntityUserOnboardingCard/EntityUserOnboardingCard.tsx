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

import { useAsync } from 'react-use';
import {
  InfoCard,
  Progress,
  ResponseErrorPanel,
  EmptyState,
  LinearGauge,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Box, Tag, TagGroup, Text } from '@backstage/ui';
import {
  RiCheckboxCircleLine,
  RiTimeLine,
  RiForbidLine,
} from '@remixicon/react';
import { onboardingApiRef } from '../../api/OnboardingApi';
import { OnboardingProgress, OnboardingTemplate, Phase } from '../../types';
import { PHASE_LABELS, PHASE_ORDER } from '../../constants';
import styles from './EntityUserOnboardingCard.module.css';

function computeStats(progress: OnboardingProgress) {
  const total = progress.tasks.length;
  const done = progress.tasks.filter(t => t.status === 'done').length;
  const blocked = progress.tasks.filter(t => t.status === 'blocked').length;
  const inProgress = progress.tasks.filter(
    t => t.status === 'in-progress',
  ).length;
  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, blocked, inProgress, completionPct };
}

/**
 * Card component that displays onboarding progress for a user entity.
 * @public
 */
export function EntityUserOnboardingCard() {
  const { entity } = useEntity();
  const onboardingApi = useApi(onboardingApiRef);

  const userId = `user:default/${entity.metadata.name}`;

  const { value, loading, error } = useAsync(async () => {
    const [prog, templates] = await Promise.all([
      onboardingApi.getProgress(userId),
      onboardingApi.getTemplates(),
    ]);
    return { progress: prog, templates };
  }, [userId]);

  const progress = value?.progress;
  const templates = value?.templates;

  if (loading) {
    return (
      <InfoCard title="Onboarding Progress">
        <Progress />
      </InfoCard>
    );
  }

  if (error) {
    return (
      <InfoCard title="Onboarding Progress">
        <ResponseErrorPanel error={error} />
      </InfoCard>
    );
  }

  if (!progress || progress.tasks.length === 0) {
    return (
      <InfoCard title="Onboarding Progress">
        <EmptyState
          missing="data"
          title="No onboarding progress found"
          description={`${entity.metadata.name} has not been assigned an onboarding template yet.`}
        />
      </InfoCard>
    );
  }

  const { done, blocked, inProgress, completionPct } = computeStats(progress);

  // Group tasks by phase using template data to map taskId -> phase
  const byPhase: Record<Phase, { done: number; total: number }> = {
    day1: { done: 0, total: 0 },
    week1: { done: 0, total: 0 },
    week2: { done: 0, total: 0 },
    month1: { done: 0, total: 0 },
  };

  const matchingTemplate = templates?.find(
    (t: OnboardingTemplate) => t.metadata.name === progress.templateName,
  );

  if (matchingTemplate) {
    const taskPhaseMap = new Map<string, Phase>();
    for (const phase of matchingTemplate.spec.phases) {
      for (const task of phase.tasks) {
        taskPhaseMap.set(task.id, phase.id as Phase);
      }
    }

    for (const taskProgress of progress.tasks) {
      const phaseId = taskPhaseMap.get(taskProgress.taskId);
      if (phaseId && byPhase[phaseId]) {
        byPhase[phaseId].total += 1;
        if (taskProgress.status === 'done') {
          byPhase[phaseId].done += 1;
        }
      }
    }
  }

  return (
    <InfoCard
      title="Onboarding Progress"
      subheader={`Template: ${progress.templateName}`}
    >
      <Box className={styles.gaugeWrapper}>
        <LinearGauge value={completionPct / 100} />
        <Text variant="body-x-small" color="secondary">
          {completionPct}% complete
        </Text>
      </Box>

      <TagGroup className={styles.statsRow} aria-label="Progress stats">
        <Tag
          className={styles.chip}
          icon={<RiCheckboxCircleLine size={14} />}
          size="small"
        >
          {done} done
        </Tag>
        {inProgress > 0 && (
          <Tag
            className={styles.chip}
            icon={<RiTimeLine size={14} />}
            size="small"
          >
            {inProgress} in progress
          </Tag>
        )}
        {blocked > 0 && (
          <Tag
            className={styles.chip}
            icon={<RiForbidLine size={14} />}
            size="small"
          >
            {blocked} blocked
          </Tag>
        )}
      </TagGroup>

      {Object.keys(byPhase).some(p => byPhase[p as Phase].total > 0) && (
        <>
          <Text as="p" className={styles.phaseLabel}>
            By phase
          </Text>
          {PHASE_ORDER.filter(p => byPhase[p].total > 0).map(phase => (
            <Box key={phase} className={styles.phaseRow}>
              <Text as="span" className={styles.phaseName}>
                {PHASE_LABELS[phase]}
              </Text>
              <Text as="span" className={styles.phaseCount}>
                {byPhase[phase].done}/{byPhase[phase].total}
              </Text>
            </Box>
          ))}
        </>
      )}
    </InfoCard>
  );
}
