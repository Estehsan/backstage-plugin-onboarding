/// <reference types="jest" />

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

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { onboardingDocsEditorApiRef } from '../api/OnboardingDocsEditorApi';
import { DocumentationField } from '../components/TemplateStudio/DocumentationField';
import { techDocsOnboardingDocsEditorApi } from './index';

jest.mock('@estehsaan/backstage-plugin-techdocs-editor-react', () => ({
  TechDocsMarkdownEditor: (props: {
    initialContent: string;
    onChange: (markdown: string) => void;
  }) => (
    <textarea
      aria-label="rich"
      defaultValue={props.initialContent}
      onChange={e => props.onChange(e.target.value)}
    />
  ),
}));

describe('TechDocs-backed documentation editor (config #1)', () => {
  it('advertises rich editing and renders the WYSIWYG editor without the fallback hint', async () => {
    const onChange = jest.fn();
    expect(techDocsOnboardingDocsEditorApi.capabilities.richTextEditing).toBe(
      true,
    );

    await renderInTestApp(
      <TestApiProvider
        apis={[[onboardingDocsEditorApiRef, techDocsOnboardingDocsEditorApi]]}
      >
        <DocumentationField value="seed" onChange={onChange} />
      </TestApiProvider>,
    );

    const rich = await screen.findByLabelText('rich');
    expect(rich).toBeInTheDocument();

    await userEvent.type(rich, '!');
    expect(onChange).toHaveBeenCalled();

    expect(
      screen.queryByText(
        'Rich Markdown editing requires the TechDocs Editor plugin.',
      ),
    ).not.toBeInTheDocument();
  });
});
