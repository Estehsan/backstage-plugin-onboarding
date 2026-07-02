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

import { useEffect, useState } from 'react';
import { Box, Text } from '@backstage/ui';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { OnboardingApi } from '../../api/OnboardingApi';
import { TeamJoinerSummary, OnboardingCatalogUser } from '../../types';
import styles from './TeamView.module.css';

/** @public */
export interface AssignBuddyDialogProps {
  joiner: TeamJoinerSummary | undefined;
  onboardingApi: OnboardingApi;
  onClose: () => void;
  onAssigned: () => void;
}

/** @public */
export function AssignBuddyDialog(props: AssignBuddyDialogProps) {
  const { joiner, onboardingApi, onClose, onAssigned } = props;

  const [buddyOptions, setBuddyOptions] = useState<OnboardingCatalogUser[]>([]);
  const [buddySearchLoading, setBuddySearchLoading] = useState(false);
  const [buddyInputValue, setBuddyInputValue] = useState('');
  const [selectedBuddy, setSelectedBuddy] =
    useState<OnboardingCatalogUser | null>(null);
  const [assigningBuddy, setAssigningBuddy] = useState(false);
  const [assignError, setAssignError] = useState<string | undefined>();

  // Debounced buddy search
  useEffect(() => {
    if (!joiner) {
      setBuddyOptions([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setBuddySearchLoading(true);
      try {
        const users = await onboardingApi.searchCatalogUsers(buddyInputValue);
        setBuddyOptions(users);
      } catch (e) {
        setBuddyOptions([]);
      } finally {
        setBuddySearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [onboardingApi, joiner, buddyInputValue]);

  const handleConfirm = async () => {
    if (!joiner || !selectedBuddy) return;

    setAssigningBuddy(true);
    setAssignError(undefined);

    try {
      await onboardingApi.setBuddy(joiner.userId, selectedBuddy.entityRef);
      onAssigned();
      onClose();
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : String(e));
    } finally {
      setAssigningBuddy(false);
    }
  };

  const handleClose = () => {
    if (!assigningBuddy) {
      onClose();
    }
  };

  return (
    // Keying by the joiner's userId forces React to remount this subtree
    // (and its useState hooks) whenever the target joiner changes, so the
    // previous joiner's search text/selection/error can never flash before
    // being cleared — a plain useEffect reset would run after paint and
    // risk a stale-state flash for one commit.
    <Dialog
      key={joiner?.userId ?? 'closed'}
      open={!!joiner}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Assign Buddy</DialogTitle>
      <DialogContent>
        {joiner && (
          <Text variant="body-small">
            Assign a buddy for <strong>{joiner.displayName}</strong>.
          </Text>
        )}

        <Box mt="3">
          <Autocomplete
            options={buddyOptions}
            loading={buddySearchLoading}
            getOptionLabel={opt =>
              opt.email ? `${opt.displayName} (${opt.email})` : opt.displayName
            }
            inputValue={buddyInputValue}
            onInputChange={(_, val) => {
              setBuddyInputValue(val);
              if (!val.trim()) {
                setSelectedBuddy(null);
              }
            }}
            onChange={(_, selected) => {
              setSelectedBuddy(selected);
            }}
            disabled={assigningBuddy}
            noOptionsText={buddySearchLoading ? 'Searching…' : 'No users found'}
            renderInput={params => (
              <TextField
                {...params}
                margin="dense"
                label="Buddy"
                variant="outlined"
                fullWidth
                placeholder="Search for a buddy"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {buddySearchLoading && <CircularProgress size={16} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Box>

        {assignError && (
          <Text variant="body-small" className={styles.errorText}>
            {assignError}
          </Text>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={assigningBuddy}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          color="primary"
          variant="contained"
          disabled={assigningBuddy || !selectedBuddy}
        >
          {assigningBuddy ? 'Assigning...' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
