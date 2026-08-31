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

import { TextField } from '@material-ui/core';
import {
  OnboardingDocsEditorApi,
  OnboardingDocumentationEditorProps,
} from './OnboardingDocsEditorApi';

function PlainMarkdownEditor(props: OnboardingDocumentationEditorProps) {
  const { value, onChange } = props;
  return (
    <TextField
      label="Documentation (Markdown)"
      multiline
      minRows={6}
      fullWidth
      variant="outlined"
      value={value}
      onChange={e => onChange(e.target.value)}
      helperText="Plain-text Markdown. Install the TechDocs Editor plugin for rich WYSIWYG editing."
    />
  );
}

/**
 * Default plain-text documentation editor used when TechDocs Editor is not
 * wired.
 * @public
 */
export const defaultOnboardingDocsEditorApi: OnboardingDocsEditorApi = {
  capabilities: { richTextEditing: false },
  DocumentationEditor: PlainMarkdownEditor,
};
