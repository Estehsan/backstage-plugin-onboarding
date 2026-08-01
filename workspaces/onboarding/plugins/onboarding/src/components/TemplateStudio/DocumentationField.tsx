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

import { TechDocsMarkdownEditor } from '@estehsaan/backstage-plugin-techdocs-editor-react';

/** @public */
export interface DocumentationFieldProps {
  value: string;
  onChange: (markdown: string) => void;
}

/**
 * Rich markdown editor for a task's long-form documentation, reusing the
 * TechDocs Editor's WYSIWYG markdown component so authors edit the doc inline
 * instead of maintaining it separately.
 */
export function DocumentationField(props: DocumentationFieldProps) {
  const { value, onChange } = props;
  return (
    <TechDocsMarkdownEditor
      initialContent={value}
      onChange={onChange}
      sourceMode={false}
    />
  );
}
