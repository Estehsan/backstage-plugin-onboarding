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

import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';

const PROGRESS_COLOR = '#1D9E75';

const rootStyles = {
  width: '100%',
  marginBottom: 16,
};

const labelRowStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 4,
};

const progressStyles = {
  height: 10,
  borderRadius: 5,
  backgroundColor: '#e0e0e0',
};

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
    <div style={rootStyles}>
      <Box style={labelRowStyles}>
        <Typography variant="body2" color="textSecondary">
          {completed} of {total} tasks complete
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {percent}%
        </Typography>
      </Box>
      <div style={progressStyles}>
        <LinearProgress
          variant="determinate"
          value={percent}
          style={{
            height: '100%',
            borderRadius: 5,
            backgroundColor: PROGRESS_COLOR,
          }}
        />
      </div>
    </div>
  );
}
