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

import { ElementType } from 'react';
import { Box, Text, Tag } from '@backstage/ui';
import Collapse from '@material-ui/core/Collapse';
import {
  RiBookLine,
  RiPlayCircleLine,
  RiFileTextLine,
  RiGraduationCapLine,
  RiCodeLine,
  RiToolsLine,
  RiTimeLine,
  RiLightbulbLine,
} from '@remixicon/react';
import { OnboardingTask, ResourceType } from '../../types';
import styles from './TaskDetailPanel.module.css';

const RESOURCE_ICONS: Record<ResourceType, ElementType> = {
  video: RiPlayCircleLine,
  doc: RiFileTextLine,
  article: RiBookLine,
  course: RiGraduationCapLine,
  repo: RiCodeLine,
  tool: RiToolsLine,
};

const RESOURCE_LABELS: Record<ResourceType, string> = {
  video: 'Video',
  doc: 'Documentation',
  article: 'Article',
  course: 'Course',
  repo: 'Repository',
  tool: 'Tool',
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

function parseSteps(doc: string): string[] {
  const lines = doc.split('\n').filter(l => l.trim().length > 0);
  const numbered = lines.filter(l => /^\d+[\.\)]\s/.test(l.trim()));
  if (numbered.length > 1) {
    return numbered.map(l => l.replace(/^\d+[\.\)]\s*/, '').trim());
  }
  return lines.map(l => l.trim());
}

/** @public */
export interface TaskDetailPanelProps {
  task: OnboardingTask;
  open: boolean;
}

/** @public */
export function TaskDetailPanel(props: TaskDetailPanelProps) {
  const { task, open } = props;

  const hasDetail =
    task.documentation ||
    (task.resources && task.resources.length > 0) ||
    (task.recommendations && task.recommendations.length > 0);

  if (!hasDetail) return null;

  const steps = task.documentation ? parseSteps(task.documentation) : [];

  return (
    <Collapse in={open} timeout="auto" unmountOnExit>
      <div className={styles.root}>
        <div className={styles.inner}>
          {/* Time Estimate */}
          {task.estimatedMinutes && (
            <div className={styles.timeEstimate}>
              <RiTimeLine size={16} />
              <Text variant="body-small">
                Estimated time: {formatDuration(task.estimatedMinutes)}
              </Text>
            </div>
          )}

          {/* Step-by-step documentation */}
          {steps.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <RiBookLine size={16} />
                <Text variant="title-small">Step-by-step guide</Text>
              </div>
              <Box>
                {steps.map((step, i) => (
                  <div key={i} className={styles.stepRow}>
                    <span className={styles.stepNumber}>{i + 1}</span>
                    <Text variant="body-small">{step}</Text>
                  </div>
                ))}
              </Box>
            </div>
          )}

          {/* Resources */}
          {task.resources && task.resources.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <RiGraduationCapLine size={16} />
                <Text variant="title-small">
                  Resources &amp; learning materials
                </Text>
              </div>
              <ul className={styles.resourceList}>
                {task.resources.map((res, i) => {
                  const Icon = RESOURCE_ICONS[res.type] ?? RiFileTextLine;
                  return (
                    <li key={i} className={styles.resourceItem}>
                      <span className={styles.resourceIcon}>
                        <Icon size={16} />
                      </span>
                      <div className={styles.resourceContent}>
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.resourceLink}
                        >
                          {res.title}
                        </a>
                        <Tag size="small">{RESOURCE_LABELS[res.type]}</Tag>
                        {res.duration && (
                          <Tag size="small" icon={<RiTimeLine size={12} />}>
                            {res.duration}
                          </Tag>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {task.recommendations && task.recommendations.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <RiLightbulbLine size={16} />
                <Text variant="title-small">Tips &amp; recommendations</Text>
              </div>
              {task.recommendations.map((rec, i) => (
                <div key={i} className={styles.recommendationItem}>
                  <span className={styles.recommendationIcon}>
                    <RiLightbulbLine size={16} />
                  </span>
                  <Text variant="body-small">{rec}</Text>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Collapse>
  );
}
