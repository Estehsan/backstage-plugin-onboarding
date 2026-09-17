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

import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
  Flex,
  Link,
  Text,
  TextField,
} from '@backstage/ui';
import {
  PublishTemplateFailure,
  PublishTemplateRequest,
  PublishTemplateResponse,
  TemplateValidationIssue,
} from '../../types';
import styles from './TemplateStudio.module.css';

function toPublishFailure(e: unknown): PublishTemplateFailure {
  if (e instanceof Error) {
    const issues = (e as Error & { issues?: TemplateValidationIssue[] }).issues;
    return { message: e.message, ...(issues ? { issues } : {}) };
  }
  return { message: String(e) };
}

/** @public */
export interface PublishDialogProps {
  hasSourceLocation: boolean;
  disabled?: boolean;
  onPublish: (
    request: PublishTemplateRequest,
  ) => Promise<PublishTemplateResponse>;
}

/**
 * Collects pull-request details and publishes the template draft via the
 * backend, which opens a PR through the shared TechDocs Editor VCS service.
 */
export function PublishDialog(props: PublishDialogProps) {
  const { hasSourceLocation, disabled, onPublish } = props;

  const [isOpen, setOpen] = useState(false);
  const [title, setTitle] = useState('Update onboarding template');
  const [description, setDescription] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [filePath, setFilePath] = useState('');
  const [draft, setDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<PublishTemplateFailure | undefined>();
  const [result, setResult] = useState<PublishTemplateResponse | undefined>();

  const targetRequired = !hasSourceLocation;
  const canSubmit =
    !!title.trim() &&
    (!targetRequired || (!!repoUrl.trim() && !!filePath.trim()));

  // Only a response that actually carries a pull request URL may render the
  // success state — otherwise a malformed 200 would show a dead link.
  const published = result?.url ? result : undefined;

  const handlePublish = async () => {
    setBusy(true);
    setFailure(undefined);
    try {
      const response = await onPublish({
        title: title.trim(),
        description: description.trim() || undefined,
        baseBranch: baseBranch.trim() || undefined,
        draft,
        repoUrl: repoUrl.trim() || undefined,
        filePath: filePath.trim() || undefined,
      });
      if (!response?.url) {
        throw new Error(
          'Publish succeeded but the backend returned no pull request URL',
        );
      }
      setResult(response);
    } catch (e) {
      setFailure(toPublishFailure(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setOpen}>
      <Button variant="primary" isDisabled={disabled}>
        Publish…
      </Button>
      <Dialog>
        <DialogHeader>Publish template</DialogHeader>
        <DialogBody>
          <div className={styles.dialogBody}>
            {published ? (
              <Alert
                status="success"
                title={
                  <Text variant="body-small">
                    Pull request opened:{' '}
                    <Link href={published.url}>#{published.number}</Link>
                    {published.providerId ? ` via ${published.providerId}` : ''}
                  </Text>
                }
                description={
                  <Flex direction="column" gap="1">
                    {published.headBranch && (
                      <Text variant="body-small">
                        Branch:{' '}
                        <span className={styles.issuePath}>
                          {published.headBranch}
                        </span>
                      </Text>
                    )}
                    {published.repoUrl && (
                      <Text variant="body-small">
                        Repository:{' '}
                        <span className={styles.issuePath}>
                          {published.repoUrl}
                        </span>
                      </Text>
                    )}
                    {published.filePath && (
                      <Text variant="body-small">
                        File:{' '}
                        <span className={styles.issuePath}>
                          {published.filePath}
                        </span>
                      </Text>
                    )}
                  </Flex>
                }
              />
            ) : (
              <>
                <TextField
                  label="Pull request title"
                  value={title}
                  onChange={setTitle}
                />
                <TextField
                  label="Description"
                  value={description}
                  onChange={setDescription}
                />
                <TextField
                  label="Base branch (optional)"
                  placeholder="defaults to the repo default branch"
                  value={baseBranch}
                  onChange={setBaseBranch}
                />
                {targetRequired && (
                  <>
                    <TextField
                      label="Repository URL"
                      placeholder="https://github.com/org/repo"
                      value={repoUrl}
                      onChange={setRepoUrl}
                    />
                    <TextField
                      label="File path"
                      placeholder="catalog/onboarding/engineer.yaml"
                      value={filePath}
                      onChange={setFilePath}
                    />
                  </>
                )}
                <Checkbox isSelected={draft} onChange={setDraft}>
                  Open as draft pull request
                </Checkbox>
                {failure && (
                  <Alert
                    status="danger"
                    title={failure.message}
                    description={
                      failure.issues && failure.issues.length > 0 ? (
                        <Flex direction="column" gap="1">
                          {failure.issues.map((issue, i) => (
                            <Text
                              key={`${issue.path}-${i}`}
                              variant="body-small"
                            >
                              <span className={styles.issuePath}>
                                {issue.path}
                              </span>{' '}
                              {issue.message}
                            </Text>
                          ))}
                        </Flex>
                      ) : undefined
                    }
                  />
                )}
              </>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onPress={() => setOpen(false)}>
            {published ? 'Close' : 'Cancel'}
          </Button>
          {!published && (
            <Button
              variant="primary"
              isDisabled={!canSubmit || busy}
              onPress={handlePublish}
            >
              {busy ? 'Publishing…' : 'Open pull request'}
            </Button>
          )}
        </DialogFooter>
      </Dialog>
    </DialogTrigger>
  );
}
