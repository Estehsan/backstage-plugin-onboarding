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

import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';
import { onboardingApiRef } from '../api/OnboardingApi';
import { useAutomatedTask } from './useAutomatedTask';

const userId = 'user:default/testuser';

function createOnboardingApiMock() {
  return {
    getProgress: jest.fn(),
    updateTaskStatus: jest.fn().mockResolvedValue(undefined),
    getTeamStats: jest.fn(),
    getTemplates: jest.fn(),
    assignTemplate: jest.fn(),
    searchCatalogUsers: jest.fn(),
  };
}

function createScaffolderApiMock() {
  return {
    scaffold: jest.fn().mockResolvedValue({ taskId: 'scaffolder-task-1' }),
    getTask: jest.fn(),
    getIntegrationsList: jest.fn(),
    getTemplateParameterSchema: jest.fn(),
    streamLogs: jest.fn(),
    listActions: jest.fn(),
    listTasks: jest.fn(),
    cancelTask: jest.fn(),
    autocomplete: jest.fn(),
  };
}

function renderUseAutomatedTask(
  onboardingApi: ReturnType<typeof createOnboardingApiMock>,
  scaffolderApi: ReturnType<typeof createScaffolderApiMock>,
  onProgressUpdate: () => void,
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestApiProvider
      apis={[
        [onboardingApiRef, onboardingApi],
        [scaffolderApiRef, scaffolderApi],
      ]}
    >
      {children}
    </TestApiProvider>
  );

  return renderHook(() => useAutomatedTask({ userId, onProgressUpdate }), {
    wrapper,
  });
}

describe('useAutomatedTask', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('polls until completion and marks the task done', async () => {
    const onboardingApi = createOnboardingApiMock();
    const scaffolderApi = createScaffolderApiMock();
    scaffolderApi.getTask
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValue({ status: 'completed' });
    const onProgressUpdate = jest.fn();

    const { result } = renderUseAutomatedTask(
      onboardingApi,
      scaffolderApi,
      onProgressUpdate,
    );

    await act(async () => {
      await result.current.triggerAutomatedTask('task-1', 'setup-env');
    });

    expect(onboardingApi.updateTaskStatus).toHaveBeenCalledWith(
      userId,
      'task-1',
      'in-progress',
    );

    // First poll: still processing.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(onboardingApi.updateTaskStatus).not.toHaveBeenCalledWith(
      userId,
      'task-1',
      'done',
    );

    // Second poll: completed.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });

    expect(onboardingApi.updateTaskStatus).toHaveBeenCalledWith(
      userId,
      'task-1',
      'done',
    );

    // Polling has stopped — further time does not produce more getTask calls.
    const callsAfterDone = scaffolderApi.getTask.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(9000);
    });
    expect(scaffolderApi.getTask).toHaveBeenCalledTimes(callsAfterDone);
  });

  it('stops polling and marks the task blocked when scaffolder fails', async () => {
    const onboardingApi = createOnboardingApiMock();
    const scaffolderApi = createScaffolderApiMock();
    scaffolderApi.getTask.mockResolvedValue({ status: 'failed' });
    const onProgressUpdate = jest.fn();

    const { result } = renderUseAutomatedTask(
      onboardingApi,
      scaffolderApi,
      onProgressUpdate,
    );

    await act(async () => {
      await result.current.triggerAutomatedTask('task-1', 'setup-env');
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });

    expect(onboardingApi.updateTaskStatus).toHaveBeenCalledWith(
      userId,
      'task-1',
      'blocked',
      expect.stringContaining('failed'),
    );

    const callsAfterFail = scaffolderApi.getTask.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(9000);
    });
    expect(scaffolderApi.getTask).toHaveBeenCalledTimes(callsAfterFail);
  });

  it('stops polling and marks blocked after the maximum attempts', async () => {
    const onboardingApi = createOnboardingApiMock();
    const scaffolderApi = createScaffolderApiMock();
    scaffolderApi.getTask.mockResolvedValue({ status: 'processing' });
    const onProgressUpdate = jest.fn();

    const { result } = renderUseAutomatedTask(
      onboardingApi,
      scaffolderApi,
      onProgressUpdate,
    );

    await act(async () => {
      await result.current.triggerAutomatedTask('task-1', 'setup-env');
    });

    // 100 attempts at 3s, plus one extra tick to cross the threshold.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000 * 101);
    });

    expect(onboardingApi.updateTaskStatus).toHaveBeenCalledWith(
      userId,
      'task-1',
      'blocked',
      expect.stringContaining('timed out'),
    );

    const callsAfterTimeout = scaffolderApi.getTask.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(9000);
    });
    expect(scaffolderApi.getTask).toHaveBeenCalledTimes(callsAfterTimeout);
  });

  it('does not update state after unmount', async () => {
    const onboardingApi = createOnboardingApiMock();
    const scaffolderApi = createScaffolderApiMock();
    scaffolderApi.getTask.mockResolvedValue({ status: 'completed' });
    const onProgressUpdate = jest.fn();

    const { result, unmount } = renderUseAutomatedTask(
      onboardingApi,
      scaffolderApi,
      onProgressUpdate,
    );

    await act(async () => {
      await result.current.triggerAutomatedTask('task-1', 'setup-env');
    });

    unmount();
    onProgressUpdate.mockClear();

    // Advancing timers after unmount must not trigger further polling or
    // produce act(...) warnings from state updates.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(9000);
    });

    expect(onProgressUpdate).not.toHaveBeenCalled();
  });
});
