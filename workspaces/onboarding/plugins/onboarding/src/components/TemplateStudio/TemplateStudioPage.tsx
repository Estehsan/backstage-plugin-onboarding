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

import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Progress } from '@backstage/core-components';
import { Alert, Button, Flex, Text, TextField } from '@backstage/ui';
import { onboardingApiRef } from '../../api/OnboardingApi';
import {
  OnboardingTask,
  OnboardingTemplate,
  Phase,
  TemplateBlock,
  TemplateValidationIssue,
} from '../../types';
import { BlockLibrary } from './BlockLibrary';
import { JoinerPreview } from './JoinerPreview';
import { LiveYamlView } from './LiveYamlView';
import { PhaseCard } from './PhaseCard';
import { PublishDialog } from './PublishDialog';
import { ValidationBar } from './ValidationBar';
import {
  PHASES,
  addTask,
  insertBlock,
  removeTask,
  updateMetadata,
  updateSpecField,
  updateTask,
} from './templateOps';
import styles from './TemplateStudio.module.css';

/** @public */
export interface TemplateStudioPageProps {
  /** Template name from the route; `new` starts a create flow. */
  templateName: string;
}

type StudioView = 'editor' | 'yaml' | 'preview';

/**
 * Container for the Onboarding Template Studio: loads a draft, holds the
 * editable template in state, and coordinates the structured editor, the live
 * YAML view, validation, preview, and publishing.
 */
export function TemplateStudioPage(props: TemplateStudioPageProps) {
  const { templateName } = props;
  const api = useApi(onboardingApiRef);
  const isNew = templateName === 'new';

  const [template, setTemplate] = useState<OnboardingTemplate | undefined>();
  const [sourceLocation, setSourceLocation] = useState<string | undefined>();
  const [blocks, setBlocks] = useState<TemplateBlock[]>([]);
  const [issues, setIssues] = useState<TemplateValidationIssue[]>([]);
  const [view, setView] = useState<StudioView>('editor');
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();

  // Create-flow form state.
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .listBlocks()
      .then(b => !cancelled && setBlocks(b))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (isNew) {
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getTemplateDraft(templateName)
      .then(draft => {
        if (cancelled) return;
        setTemplate(draft.template);
        setSourceLocation(draft.sourceLocation);
        setError(undefined);
      })
      .catch(
        e => !cancelled && setError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api, isNew, templateName]);

  const focusField = useCallback((path: string) => {
    const escaped =
      typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(path) : path;
    const el = document.querySelector(`[data-field-path="${escaped}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el.querySelector('input, textarea') as HTMLElement | null)?.focus();
    }
  }, []);

  const runValidation = useCallback(
    async (next: OnboardingTemplate) => {
      try {
        setIssues(await api.validateTemplate(next.metadata.name, next));
      } catch {
        // Validation is advisory in the UI; ignore transient errors.
      }
    },
    [api],
  );

  const mutate = useCallback(
    (next: OnboardingTemplate) => {
      setTemplate(next);
      runValidation(next);
    },
    [runValidation],
  );

  const handleCreate = async () => {
    try {
      const draft = await api.createTemplateDraft({
        name: newName.trim(),
        role: newRole.trim(),
        title: newTitle.trim() || newName.trim(),
      });
      setTemplate(draft.template);
      setSourceLocation(draft.sourceLocation);
      setStatus('Draft created.');
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSave = async () => {
    if (!template) return;
    try {
      const saved = await api.saveTemplateDraft(
        template.metadata.name,
        template,
        sourceLocation,
      );
      setTemplate(saved.template);
      setStatus('Draft saved.');
      setError(undefined);
      setIssues([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) {
    return <Progress />;
  }

  if (isNew && !template) {
    return (
      <div className={styles.page}>
        <Text variant="title-medium">New onboarding template</Text>
        {error && <Alert status="danger">{error}</Alert>}
        <Flex direction="column" gap="3" style={{ maxWidth: 480 }}>
          <TextField
            label="Name"
            placeholder="engineer"
            value={newName}
            onChange={setNewName}
          />
          <TextField
            label="Role"
            placeholder="engineer"
            value={newRole}
            onChange={setNewRole}
          />
          <TextField
            label="Title"
            placeholder="Engineer onboarding"
            value={newTitle}
            onChange={setNewTitle}
          />
          <Button
            variant="primary"
            isDisabled={!newName.trim() || !newRole.trim()}
            onPress={handleCreate}
          >
            Create draft
          </Button>
        </Flex>
      </div>
    );
  }

  if (!template) {
    return (
      <div className={styles.page}>
        <Alert status="danger">{error ?? 'Template not found.'}</Alert>
      </div>
    );
  }

  const usedPhases = new Set(template.spec.phases.map(p => p.id));
  const missingPhases = PHASES.filter(p => !usedPhases.has(p));

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Text variant="title-medium">
          Template Studio — {template.metadata.title}
        </Text>
        <Flex gap="2" align="center">
          <div className={styles.viewSwitch}>
            {(['editor', 'yaml', 'preview'] as StudioView[]).map(v => (
              <Button
                key={v}
                size="small"
                variant={view === v ? 'primary' : 'tertiary'}
                onPress={() => setView(v)}
              >
                {v === 'editor' ? 'Editor' : v === 'yaml' ? 'YAML' : 'Preview'}
              </Button>
            ))}
          </div>
          <Button variant="secondary" onPress={handleSave}>
            Save draft
          </Button>
          <PublishDialog
            hasSourceLocation={Boolean(sourceLocation)}
            disabled={issues.some(i => i.severity === 'error')}
            onPublish={request =>
              api.publishTemplate(template.metadata.name, request)
            }
          />
        </Flex>
      </div>

      {status && <Alert status="info">{status}</Alert>}
      {error && <Alert status="danger">{error}</Alert>}

      <ValidationBar issues={issues} onSelectIssue={focusField} />

      {view === 'editor' && (
        <div className={styles.twoColumns}>
          <div className={styles.stack}>
            <div className={styles.card}>
              <Text variant="title-small">Details</Text>
              <TextField
                label="Title"
                value={template.metadata.title}
                onChange={value =>
                  mutate(updateMetadata(template, { title: value }))
                }
              />
              <TextField
                label="Description"
                value={template.metadata.description ?? ''}
                onChange={value =>
                  mutate(updateMetadata(template, { description: value }))
                }
              />
              <TextField
                label="Role"
                value={template.spec.role}
                onChange={value =>
                  mutate(updateSpecField(template, { role: value }))
                }
              />
              <TextField
                label="Team (optional)"
                value={template.spec.team ?? ''}
                onChange={value =>
                  mutate(updateSpecField(template, { team: value }))
                }
              />
            </div>

            {template.spec.phases.map((phase, phaseIndex) => (
              <PhaseCard
                key={phase.id}
                phase={phase.id}
                phaseIndex={phaseIndex}
                tasks={phase.tasks}
                onChangeTask={(index: number, patch: Partial<OnboardingTask>) =>
                  mutate(updateTask(template, phase.id, index, patch))
                }
                onRemoveTask={(index: number) =>
                  mutate(removeTask(template, phase.id, index))
                }
                onAddTask={() => mutate(addTask(template, phase.id))}
              />
            ))}

            {missingPhases.length > 0 && (
              <Flex gap="2" wrap="wrap">
                {missingPhases.map(phase => (
                  <Button
                    key={phase}
                    variant="tertiary"
                    size="small"
                    onPress={() => mutate(addTask(template, phase as Phase))}
                  >
                    Add {phase} phase
                  </Button>
                ))}
              </Flex>
            )}
          </div>

          <div className={styles.stack}>
            <BlockLibrary
              blocks={blocks}
              onInsert={block => mutate(insertBlock(template, block))}
            />
          </div>
        </div>
      )}

      {view === 'yaml' && (
        <div className={styles.twoColumns}>
          <LiveYamlView template={template} onApply={mutate} />
          <JoinerPreview template={template} />
        </div>
      )}

      {view === 'preview' && <JoinerPreview template={template} />}
    </div>
  );
}
