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

import { useRouteRefParams } from '@backstage/core-plugin-api';
import { templateEditorRouteRef } from '../../routes';
import { TemplateStudioPage } from './TemplateStudioPage';

/**
 * Reads the `:name` route param and renders the Template Studio editor.
 * @public
 */
export function TemplateStudioRoutePage(): JSX.Element {
  const { name } = useRouteRefParams(templateEditorRouteRef);
  return <TemplateStudioPage templateName={name} />;
}
