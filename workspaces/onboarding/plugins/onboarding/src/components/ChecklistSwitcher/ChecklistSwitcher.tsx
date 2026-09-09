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

import { Card, Flex, Text } from '@backstage/ui';
import { OnboardingProgress, OnboardingTemplate } from '../../types';
import styles from './ChecklistSwitcher.module.css';

/** @public */
export interface ChecklistSwitcherProps {
  progressList: OnboardingProgress[];
  templates: OnboardingTemplate[];
  selectedTemplateName: string;
  onSelect: (templateName: string) => void;
}

/**
 * Renders each of a user's assigned onboarding templates as its own selectable
 * checklist card, so multiple concurrent templates (e.g. "Backend Engineer" +
 * "New Manager") are presented as clearly separate onboarding tracks rather
 * than a single flattened list.
 *
 * @public
 */
export function ChecklistSwitcher(props: ChecklistSwitcherProps) {
  const { progressList, templates, selectedTemplateName, onSelect } = props;

  return (
    <Flex
      className={styles.root}
      gap="3"
      role="tablist"
      aria-label="Assigned onboarding checklists"
    >
      {progressList.map(progress => {
        const template = templates.find(
          t => t.metadata.name === progress.templateName,
        );
        const title = template?.metadata.title ?? progress.templateName;
        const total = progress.tasks.length;
        const done = progress.tasks.filter(t => t.status === 'done').length;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        const isSelected = progress.templateName === selectedTemplateName;
        const cardClassName = isSelected
          ? `${styles.card} ${styles.cardSelected}`
          : styles.card;

        return (
          <Card
            key={progress.templateName}
            className={cardClassName}
            onPress={() => onSelect(progress.templateName)}
            label={`Switch to ${title} checklist`}
            role="tab"
            aria-selected={isSelected}
          >
            <Flex direction="column" gap="2" className={styles.cardBody}>
              <Text
                variant="body-medium"
                weight="bold"
                className={styles.cardTitle}
              >
                {title}
              </Text>
              <Flex align="center" gap="2">
                <div className={styles.miniTrack}>
                  <div
                    className={styles.miniFill}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <Text variant="body-small" color="secondary">
                  {percent}%
                </Text>
              </Flex>
              <Text variant="body-small" color="secondary">
                {done} of {total} tasks complete
              </Text>
            </Flex>
          </Card>
        );
      })}
    </Flex>
  );
}
