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
  Link,
  TextField,
} from '@backstage/ui';
import { PublishTemplateRequest, PublishTemplateResponse } from '../../types';
import styles from './TemplateStudio.module.css';

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
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<PublishTemplateResponse | undefined>();

  const targetRequired = !hasSourceLocation;
  const canSubmit =
    !!title.trim() &&
    (!targetRequired || (!!repoUrl.trim() && !!filePath.trim()));

  const handlePublish = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const response = await onPublish({
        title: title.trim(),
        description: description.trim() || undefined,
        baseBranch: baseBranch.trim() || undefined,
        draft,
        repoUrl: repoUrl.trim() || undefined,
        filePath: filePath.trim() || undefined,
      });
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
            {result ? (
              <Alert status="success">
                Pull request opened:{' '}
                <Link href={result.url}>#{result.number}</Link>
              </Alert>
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
                {error && <Alert status="danger">{error}</Alert>}
              </>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onPress={() => setOpen(false)}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
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
