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

import { Flex, Tag, TagGroup, Text } from '@backstage/ui';
import { OnboardingTemplate } from '../../types';
import styles from './TemplateStudio.module.css';

/** @public */
export interface JoinerPreviewProps {
  template: OnboardingTemplate;
}

/**
 * Read-only preview of how the checklist will appear to a joiner, grouped by
 * phase, mirroring the runtime task list layout.
 */
export function JoinerPreview(props: JoinerPreviewProps) {
  const { template } = props;

  return (
    <Flex direction="column" gap="3">
      <Text variant="title-x-small">Joiner preview</Text>
      <Text variant="body-medium">{template.metadata.title}</Text>
      {template.spec.phases.length === 0 && (
        <Text variant="body-small">No phases yet.</Text>
      )}
      {template.spec.phases.map(phase => (
        <div key={phase.id} className={styles.phasePreview}>
          <Text variant="body-medium">{phase.id}</Text>
          {phase.tasks.map(task => (
            <Flex key={task.id} direction="column" gap="1">
              <Text variant="body-small">{task.title}</Text>
              <TagGroup aria-label={`${task.title} metadata`}>
                <Tag size="small">{task.type}</Tag>
                <Tag size="small">{task.assignee}</Tag>
                <Tag size="small">due {task.duePhase}</Tag>
              </TagGroup>
            </Flex>
          ))}
        </div>
      ))}
    </Flex>
  );
}
