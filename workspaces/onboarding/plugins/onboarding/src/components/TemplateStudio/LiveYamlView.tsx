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

import { useMemo, useState } from 'react';
import { parse, stringify } from 'yaml';
import { Alert, Button, Flex, Text } from '@backstage/ui';
import { OnboardingTemplate } from '../../types';
import styles from './TemplateStudio.module.css';

/** @public */
export interface LiveYamlViewProps {
  template: OnboardingTemplate;
  onApply: (template: OnboardingTemplate) => void;
}

function templateToYaml(template: OnboardingTemplate): string {
  return stringify(
    {
      apiVersion: template.apiVersion,
      kind: template.kind,
      metadata: template.metadata,
      spec: template.spec,
    },
    { indent: 2 },
  );
}

/**
 * Side-by-side live YAML view that stays in sync with the structured editor.
 * Editing the source and applying it parses the YAML back into the template,
 * surfacing parse errors instead of silently discarding edits.
 */
export function LiveYamlView(props: LiveYamlViewProps) {
  const { template, onApply } = props;
  const derived = useMemo(() => templateToYaml(template), [template]);
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>();

  const value = draft ?? derived;
  const dirty = draft !== undefined && draft !== derived;

  const handleApply = () => {
    try {
      const parsed = parse(value) as OnboardingTemplate;
      if (!parsed || parsed.kind !== 'OnboardingTemplate') {
        throw new Error('Document must be an OnboardingTemplate');
      }
      setError(undefined);
      setDraft(undefined);
      onApply(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Flex direction="column" gap="2">
      <Text variant="title-x-small">Live YAML</Text>
      <textarea
        aria-label="Template YAML source"
        className={styles.yaml}
        value={value}
        onChange={e => {
          setDraft(e.target.value);
          setError(undefined);
        }}
        spellCheck={false}
      />
      {error && <Alert status="danger">{error}</Alert>}
      <Flex gap="2">
        <Button variant="secondary" isDisabled={!dirty} onPress={handleApply}>
          Apply source edits
        </Button>
        <Button
          variant="tertiary"
          isDisabled={!dirty}
          onPress={() => {
            setDraft(undefined);
            setError(undefined);
          }}
        >
          Revert
        </Button>
      </Flex>
    </Flex>
  );
}
