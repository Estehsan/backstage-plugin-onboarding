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

import { Alert, Flex, Text } from '@backstage/ui';
import { TemplateValidationIssue } from '../../types';
import styles from './TemplateStudio.module.css';

/** @public */
export interface ValidationBarProps {
  issues: TemplateValidationIssue[];
  onSelectIssue: (path: string) => void;
}

/**
 * Renders validation issues as a clickable list; selecting an issue asks the
 * page to focus the offending field.
 */
export function ValidationBar(props: ValidationBarProps) {
  const { issues, onSelectIssue } = props;

  if (issues.length === 0) {
    return (
      <Alert status="success">No validation issues — ready to publish.</Alert>
    );
  }

  const errors = issues.filter(i => i.severity === 'error').length;

  return (
    <Alert status={errors > 0 ? 'danger' : 'warning'}>
      <Flex direction="column" gap="1">
        <Text variant="body-small">
          {errors > 0
            ? `${errors} error${
                errors === 1 ? '' : 's'
              } must be fixed before publishing.`
            : 'Advisory warnings found.'}
        </Text>
        {issues.map((issue, i) => (
          <button
            key={`${issue.path}-${i}`}
            type="button"
            className={styles.issue}
            onClick={() => onSelectIssue(issue.path)}
          >
            <span className={styles.issuePath}>{issue.path}</span>
            <span>{issue.message}</span>
          </button>
        ))}
      </Flex>
    </Alert>
  );
}
