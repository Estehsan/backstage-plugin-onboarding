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

import { ComponentType } from 'react';
import { createApiRef } from '@backstage/core-plugin-api';

/**
 * Props for the documentation editor component supplied by
 * {@link OnboardingDocsEditorApi}.
 * @public
 */
export interface OnboardingDocumentationEditorProps {
  value: string;
  onChange: (markdown: string) => void;
}

/**
 * Capabilities advertised by a documentation editor implementation, so the UI
 * can indicate reduced functionality.
 * @public
 */
export interface OnboardingDocsEditorCapabilities {
  /** True when the editor provides rich (WYSIWYG) markdown editing. */
  richTextEditing: boolean;
}

/**
 * Swappable seam that supplies the React component used to edit a task's
 * long-form markdown documentation in Template Studio.
 * @public
 */
export interface OnboardingDocsEditorApi {
  readonly capabilities: OnboardingDocsEditorCapabilities;
  /** Controlled markdown editor component. */
  DocumentationEditor: ComponentType<OnboardingDocumentationEditorProps>;
}

/**
 * API ref for the onboarding documentation editor seam.
 *
 * Default implementation is a plain-text fallback; install
 * `@estehsaan/backstage-plugin-onboarding/techdocs-editor` for rich editing.
 * @public
 */
export const onboardingDocsEditorApiRef = createApiRef<OnboardingDocsEditorApi>(
  {
    id: 'plugin.onboarding.docs-editor',
  },
);
