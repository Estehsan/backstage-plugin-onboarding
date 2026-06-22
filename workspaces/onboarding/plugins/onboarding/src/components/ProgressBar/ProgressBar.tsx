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

import { Box, Text } from '@backstage/ui';
import LinearProgress from '@material-ui/core/LinearProgress';
import styles from './ProgressBar.module.css';

/** @public */
export interface ProgressBarProps {
  completed: number;
  total: number;
}

/** @public */
export function ProgressBar(props: ProgressBarProps) {
  const { completed, total } = props;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Box className={styles.root}>
      <div className={styles.labelRow}>
        <Text variant="body-small" color="secondary">
          {completed} of {total} tasks complete
        </Text>
        <Text variant="body-small" color="secondary">
          {percent}%
        </Text>
      </div>
      <div className={styles.progressContainer}>
        <LinearProgress
          variant="determinate"
          value={percent}
          style={{
            height: '100%',
            borderRadius: 5,
            backgroundColor: '#1D9E75',
          }}
        />
      </div>
    </Box>
  );
}
