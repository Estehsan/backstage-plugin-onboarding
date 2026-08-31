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

import {
  ApiBlueprint,
  createApiFactory,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import { createApiFactory as createCoreApiFactory } from '@backstage/core-plugin-api';
import { TechDocsMarkdownEditor } from '@estehsaan/backstage-plugin-techdocs-editor-react';
import {
  onboardingDocsEditorApiRef,
  OnboardingDocsEditorApi,
  OnboardingDocumentationEditorProps,
} from '../api/OnboardingDocsEditorApi';

/**
 * Re-exported so the `./techdocs-editor` entry point's public API is
 * self-contained (the typed `techDocsOnboardingDocsEditorApi` references it).
 * @public
 */
export type {
  OnboardingDocsEditorApi,
  OnboardingDocsEditorCapabilities,
  OnboardingDocumentationEditorProps,
} from '../api/OnboardingDocsEditorApi';

function RichMarkdownEditor(props: OnboardingDocumentationEditorProps) {
  const { value, onChange } = props;
  return (
    <TechDocsMarkdownEditor
      initialContent={value}
      onChange={onChange}
      sourceMode={false}
    />
  );
}

/**
 * TechDocs-backed documentation editor (rich WYSIWYG).
 * @public
 */
export const techDocsOnboardingDocsEditorApi: OnboardingDocsEditorApi = {
  capabilities: { richTextEditing: true },
  DocumentationEditor: RichMarkdownEditor,
};

/**
 * NEW frontend system: install this module to replace the default plain-text
 * editor with the TechDocs WYSIWYG editor. It overrides the same extension id
 * (`api:onboarding/docs-editor`) that the onboarding plugin registers.
 * @alpha
 */
export const onboardingTechDocsEditorModule = createFrontendModule({
  pluginId: 'onboarding',
  extensions: [
    ApiBlueprint.make({
      name: 'docs-editor',
      params: defineParams =>
        defineParams(
          createApiFactory({
            api: onboardingDocsEditorApiRef,
            deps: {},
            factory: () => techDocsOnboardingDocsEditorApi,
          }),
        ),
    }),
  ],
});

/**
 * OLD frontend system: add this factory to `createApp({ apis })` to override the
 * default plain-text editor.
 * @public
 */
export const techDocsOnboardingDocsEditorApiFactory = createCoreApiFactory({
  api: onboardingDocsEditorApiRef,
  deps: {},
  factory: () => techDocsOnboardingDocsEditorApi,
});
