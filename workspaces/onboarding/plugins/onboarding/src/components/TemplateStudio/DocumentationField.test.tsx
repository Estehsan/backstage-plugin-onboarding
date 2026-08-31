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
import {
  onboardingDocsEditorApiRef,
  defaultOnboardingDocsEditorApi,
} from '../../api';
import { DocumentationField } from './DocumentationField';

// Prove the default (config #2) path never resolves the optional package: if
// anything on this path imported techdocs-editor-react, this factory would run
// and throw during module evaluation, failing the test.
jest.mock('@estehsaan/backstage-plugin-techdocs-editor-react', () => {
  throw new Error(
    'techdocs-editor-react must not be imported by the default path',
  );
});

describe('DocumentationField (fallback / config #2)', () => {
  it('renders an editable plain-text editor and the reduced-functionality hint', async () => {
    const onChange = jest.fn();
    await renderInTestApp(
      <TestApiProvider
        apis={[[onboardingDocsEditorApiRef, defaultOnboardingDocsEditorApi]]}
      >
        <DocumentationField value="" onChange={onChange} />
      </TestApiProvider>,
    );

    const textbox = await screen.findByRole('textbox');
    expect(textbox).toBeInTheDocument();

    await userEvent.type(textbox, 'hello');
    expect(onChange).toHaveBeenCalled();

    expect(
      await screen.findByText(
        'Rich Markdown editing requires the TechDocs Editor plugin.',
      ),
    ).toBeInTheDocument();
  });
});
