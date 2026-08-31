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

import { useApi } from '@backstage/core-plugin-api';
import { Text } from '@backstage/ui';
import { onboardingDocsEditorApiRef } from '../../api/OnboardingDocsEditorApi';

/** @public */
export interface DocumentationFieldProps {
  value: string;
  onChange: (markdown: string) => void;
}

/**
 * Task documentation editor. Renders whatever editor the
 * `onboardingDocsEditorApiRef` implementation supplies (plain-text by default,
 * TechDocs WYSIWYG when that opt-in module is installed).
 */
export function DocumentationField(props: DocumentationFieldProps) {
  const { value, onChange } = props;
  const editor = useApi(onboardingDocsEditorApiRef);
  const Editor = editor.DocumentationEditor;
  return (
    <>
      <Editor value={value} onChange={onChange} />
      {!editor.capabilities.richTextEditing && (
        <Text variant="body-small">
          Rich Markdown editing requires the TechDocs Editor plugin.
        </Text>
      )}
    </>
  );
}
