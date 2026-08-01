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

import { Button, Flex, Tag, TagGroup, Text } from '@backstage/ui';
import { TemplateBlock } from '../../types';
import styles from './TemplateStudio.module.css';

/** @public */
export interface BlockLibraryProps {
  blocks: TemplateBlock[];
  onInsert: (block: TemplateBlock) => void;
}

/**
 * Palette of reusable task and phase blocks that authors can insert into the
 * template with one click.
 */
export function BlockLibrary(props: BlockLibraryProps) {
  const { blocks, onInsert } = props;

  return (
    <Flex direction="column" gap="2">
      <Text variant="title-x-small">Block library</Text>
      <div className={styles.blockGrid}>
        {blocks.map(block => (
          <div key={block.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <Text variant="body-medium">{block.title}</Text>
              <TagGroup aria-label={`${block.title} kind`}>
                <Tag size="small">{block.kind}</Tag>
              </TagGroup>
            </div>
            {block.description && (
              <Text variant="body-small">{block.description}</Text>
            )}
            <Button
              variant="secondary"
              size="small"
              onPress={() => onInsert(block)}
            >
              Add block
            </Button>
          </div>
        ))}
        {blocks.length === 0 && (
          <Text variant="body-small">No blocks configured.</Text>
        )}
      </div>
    </Flex>
  );
}
