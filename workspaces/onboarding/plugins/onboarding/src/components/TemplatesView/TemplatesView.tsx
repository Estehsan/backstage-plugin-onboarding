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
import { Box, Text, Tag, TagGroup, Card, CardBody } from '@backstage/ui';
import { Link } from '@backstage/core-components';
import { useRouteRef } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { OnboardingApi } from '../../api/OnboardingApi';
import { OnboardingCatalogUser, OnboardingTemplate } from '../../types';
import { templateEditorRouteRef } from '../../routes';
import styles from './TemplatesView.module.css';

/** @public */
export interface TemplatesViewProps {
  templates: OnboardingTemplate[];
  onboardingApi: OnboardingApi;
  canEdit?: boolean;
}

/** @public */
export function TemplatesView(props: TemplatesViewProps) {
  const { templates, onboardingApi, canEdit = false } = props;
  const editorLink = useRouteRef(templateEditorRouteRef);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | undefined>();
  const [assignSuccess, setAssignSuccess] = useState(false);

  const [userOptions, setUserOptions] = useState<OnboardingCatalogUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userInputValue, setUserInputValue] = useState('');
  const [useManualUserRef, setUseManualUserRef] = useState(false);

  const [buddyOptions, setBuddyOptions] = useState<OnboardingCatalogUser[]>([]);
  const [buddySearchLoading, setBuddySearchLoading] = useState(false);
  const [buddyInputValue, setBuddyInputValue] = useState('');
  const [selectedBuddy, setSelectedBuddy] =
    useState<OnboardingCatalogUser | null>(null);

  // Debounced backend search for catalog users. Runs when the dialog is open
  // (even with an empty query) so the picker can be browsed without typing.
  useEffect(() => {
    if (!dialogOpen || useManualUserRef) {
      setUserOptions([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const users = await onboardingApi.searchCatalogUsers(userInputValue);
        setUserOptions(users);
      } catch (e) {
        setAssignError(e instanceof Error ? e.message : String(e));
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [dialogOpen, onboardingApi, useManualUserRef, userInputValue]);

  // Debounced buddy search (optional field)
  useEffect(() => {
    if (!dialogOpen) {
      setBuddyOptions([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setBuddySearchLoading(true);
      try {
        const users = await onboardingApi.searchCatalogUsers(buddyInputValue);
        setBuddyOptions(users);
      } catch (e) {
        // Don't set error for optional buddy field, just clear options
        setBuddyOptions([]);
      } finally {
        setBuddySearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [dialogOpen, onboardingApi, buddyInputValue]);

  const handleAssignClick = (templateName: string) => {
    setSelectedTemplate(templateName);
    setAssignUserId('');
    setAssignError(undefined);
    setAssignSuccess(false);
    setUserInputValue('');
    setUserOptions([]);
    setUseManualUserRef(false);
    setBuddyInputValue('');
    setBuddyOptions([]);
    setSelectedBuddy(null);
    setDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!assignUserId.trim() || !selectedTemplate) return;
    setAssigning(true);
    setAssignError(undefined);
    try {
      if (selectedBuddy) {
        await onboardingApi.assignTemplate(
          selectedTemplate,
          assignUserId.trim(),
          selectedBuddy.entityRef,
        );
      } else {
        await onboardingApi.assignTemplate(
          selectedTemplate,
          assignUserId.trim(),
        );
      }
      setAssignSuccess(true);
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : String(e));
    } finally {
      setAssigning(false);
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setSelectedTemplate('');
    setAssignUserId('');
    setUserInputValue('');
    setUserOptions([]);
    setUseManualUserRef(false);
    setBuddyInputValue('');
    setBuddyOptions([]);
    setSelectedBuddy(null);
  };

  if (templates.length === 0) {
    return (
      <Box className={styles.emptyState}>
        <Text variant="title-medium" className={styles.emptyTitle}>
          No templates available
        </Text>
        <Text variant="body-small">
          Register OnboardingTemplate entities in your catalog to get started.
        </Text>
        {canEdit && editorLink && (
          <Link to={editorLink({ name: 'new' })}>
            <Button size="small" color="primary" variant="contained">
              New template
            </Button>
          </Link>
        )}
      </Box>
    );
  }

  return (
    <>
      {canEdit && editorLink && (
        <Box className={styles.toolbar}>
          <Link to={editorLink({ name: 'new' })}>
            <Button size="small" color="primary" variant="contained">
              New template
            </Button>
          </Link>
        </Box>
      )}
      <div className={styles.grid}>
        {templates.map(template => {
          const taskCount = template.spec.phases.reduce(
            (sum, phase) => sum + phase.tasks.length,
            0,
          );
          const phaseCount = template.spec.phases.length;

          return (
            <div key={template.metadata.name}>
              <Card className={styles.card}>
                <CardBody className={styles.cardBody}>
                  <Text variant="title-medium">{template.metadata.title}</Text>
                  {template.metadata.description && (
                    <Text variant="body-small" className={styles.description}>
                      {template.metadata.description}
                    </Text>
                  )}
                  <TagGroup
                    aria-label="Template metadata"
                    className={styles.tagRow}
                  >
                    <Tag size="small">
                      {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                    </Tag>
                    <Tag size="small">
                      {phaseCount} {phaseCount === 1 ? 'phase' : 'phases'}
                    </Tag>
                    <Tag size="small">{template.spec.role}</Tag>
                    {template.spec.team && (
                      <Tag size="small">{template.spec.team}</Tag>
                    )}
                  </TagGroup>
                </CardBody>
                <div className={styles.cardFooter}>
                  <Button
                    fullWidth
                    size="small"
                    color="primary"
                    variant="contained"
                    onClick={() => handleAssignClick(template.metadata.name)}
                  >
                    Use Template
                  </Button>
                  {canEdit && editorLink && (
                    <Link
                      to={editorLink({ name: template.metadata.name })}
                      underline="none"
                    >
                      <Button
                        fullWidth
                        size="small"
                        color="primary"
                        variant="outlined"
                      >
                        Edit in Studio
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Template</DialogTitle>
        <DialogContent>
          <Text variant="body-small">
            Assign template <strong>{selectedTemplate}</strong> to a user.
            {' Search by name or email, or enter an entity reference manually.'}
          </Text>

          <Autocomplete
            options={userOptions}
            loading={userSearchLoading}
            getOptionLabel={opt =>
              opt.email ? `${opt.displayName} (${opt.email})` : opt.displayName
            }
            inputValue={userInputValue}
            onInputChange={(_, val) => {
              setUserInputValue(val);
              if (!val.trim() && !useManualUserRef) {
                setAssignUserId('');
              }
            }}
            onChange={(_, selected) => {
              setAssignUserId(selected?.entityRef ?? '');
              setUseManualUserRef(false);
            }}
            disabled={assigning || assignSuccess}
            noOptionsText={
              userSearchLoading ? 'Searching\u2026' : 'No users found'
            }
            renderInput={params => (
              <TextField
                {...params}
                id="onboarding-template-user-search"
                margin="dense"
                label="Search User"
                variant="outlined"
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {userSearchLoading && <CircularProgress size={16} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          <Box mt="2">
            <Button
              size="small"
              onClick={() => {
                setUseManualUserRef(current => {
                  if (current) {
                    // hiding manual entry — clear the autocomplete too
                    setUserInputValue('');
                    setUserOptions([]);
                  }
                  return !current;
                });
                setAssignUserId('');
              }}
              disabled={assigning || assignSuccess}
            >
              {useManualUserRef
                ? 'Hide manual entry'
                : 'Enter entity ref manually'}
            </Button>
          </Box>

          {useManualUserRef && (
            <TextField
              id="onboarding-template-user-entity-ref"
              margin="dense"
              label="User Entity Ref"
              fullWidth
              variant="outlined"
              value={assignUserId}
              onChange={e => setAssignUserId(e.target.value)}
              placeholder="user:default/jane.doe"
              disabled={assigning || assignSuccess}
            />
          )}

          <Box mt="3">
            <Autocomplete
              options={buddyOptions}
              loading={buddySearchLoading}
              getOptionLabel={opt =>
                opt.email
                  ? `${opt.displayName} (${opt.email})`
                  : opt.displayName
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
              disabled={assigning || assignSuccess}
              noOptionsText={
                buddySearchLoading ? 'Searching\u2026' : 'No users found'
              }
              renderInput={params => (
                <TextField
                  {...params}
                  id="onboarding-template-buddy-search"
                  margin="dense"
                  label="Buddy (optional)"
                  variant="outlined"
                  fullWidth
                  placeholder="Search for a buddy to help onboard this user"
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
          {assignSuccess && (
            <Text variant="body-small" className={styles.successText}>
              Template assigned successfully!
            </Text>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>
            {assignSuccess ? 'Close' : 'Cancel'}
          </Button>
          {!assignSuccess && (
            <Button
              onClick={handleAssign}
              color="primary"
              variant="contained"
              disabled={assigning || !assignUserId.trim()}
            >
              {assigning ? 'Assigning...' : 'Assign'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
