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
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import Chip from '@material-ui/core/Chip';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { OnboardingApi } from '../../api/OnboardingApi';
import { OnboardingCatalogUser, OnboardingTemplate } from '../../types';

const useStyles = makeStyles((theme: Theme) => ({
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  cardContent: {
    flex: 1,
  },
  taskCount: {
    marginTop: theme.spacing(1),
  },
  chipRow: {
    display: 'flex',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1),
    flexWrap: 'wrap',
  },
  chip: {
    height: 22,
    fontSize: '0.75rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
}));

/** @public */
export interface TemplatesViewProps {
  templates: OnboardingTemplate[];
  onboardingApi: OnboardingApi;
}

/** @public */
export function TemplatesView(props: TemplatesViewProps) {
  const { templates, onboardingApi } = props;
  const classes = useStyles();

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

  // Debounced backend search for catalog users.
  useEffect(() => {
    if (!dialogOpen || useManualUserRef || !userInputValue.trim()) {
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

  const handleAssignClick = (templateName: string) => {
    setSelectedTemplate(templateName);
    setAssignUserId('');
    setAssignError(undefined);
    setAssignSuccess(false);
    setUserInputValue('');
    setUserOptions([]);
    setUseManualUserRef(false);
    setDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!assignUserId.trim() || !selectedTemplate) return;
    setAssigning(true);
    setAssignError(undefined);
    try {
      await onboardingApi.assignTemplate(selectedTemplate, assignUserId.trim());
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
  };

  if (templates.length === 0) {
    return (
      <Box className={classes.emptyState}>
        <Typography variant="h6">No templates available</Typography>
        <Typography variant="body2">
          Register OnboardingTemplate entities in your catalog to get started.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Grid container spacing={3}>
        {templates.map(template => {
          const taskCount = template.spec.phases.reduce(
            (sum, phase) => sum + phase.tasks.length,
            0,
          );
          const phaseCount = template.spec.phases.length;

          return (
            <Grid item xs={12} sm={6} md={4} key={template.metadata.name}>
              <Card className={classes.card} variant="outlined">
                <CardContent className={classes.cardContent}>
                  <Typography variant="h6">
                    {template.metadata.title}
                  </Typography>
                  {template.metadata.description && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      gutterBottom
                    >
                      {template.metadata.description}
                    </Typography>
                  )}
                  <Box className={classes.chipRow}>
                    <Chip
                      label={`${taskCount} tasks`}
                      className={classes.chip}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={`${phaseCount} phases`}
                      className={classes.chip}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={template.spec.role}
                      className={classes.chip}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    {template.spec.team && (
                      <Chip
                        label={template.spec.team}
                        className={classes.chip}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => handleAssignClick(template.metadata.name)}
                  >
                    Use Template
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Assign template <strong>{selectedTemplate}</strong> to a user.
            {' Search by name or email, or enter an entity reference manually.'}
          </Typography>

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
              userInputValue.trim()
                ? 'No users found'
                : 'Start typing to search'
            }
            renderInput={params => (
              <TextField
                {...params}
                id="onboarding-template-user-search"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
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

          <Box mt={1}>
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

          {assignError && (
            <Typography color="error" variant="body2">
              {assignError}
            </Typography>
          )}
          {assignSuccess && (
            <Typography color="primary" variant="body2">
              Template assigned successfully!
            </Typography>
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
