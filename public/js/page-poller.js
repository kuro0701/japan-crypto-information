(function attachPagePoller(global) {
  function noop() {}

  function createPagePoller() {
    const tasks = new Set();
    let disposed = false;

    function clearTaskTimer(task) {
      if (task.timerId) {
        global.clearTimeout(task.timerId);
        task.timerId = null;
      }
    }

    function shouldPause(task) {
      return task.visibleOnly !== false && document.hidden;
    }

    function scheduleTask(task, delayMs = task.intervalMs) {
      clearTaskTimer(task);
      if (disposed || !task.enabled || shouldPause(task)) return;
      task.timerId = global.setTimeout(() => {
        task.timerId = null;
        void runTask(task, 'interval');
      }, Math.max(0, Number(delayMs) || 0));
    }

    async function runTask(task, reason) {
      if (disposed || !task.enabled || shouldPause(task)) return;
      if (task.running) {
        task.pendingReason = task.pendingReason || reason;
        return;
      }

      clearTaskTimer(task);
      task.running = true;

      try {
        await task.callback({
          reason,
          visible: !document.hidden,
        });
      } finally {
        task.running = false;
        const pendingReason = task.pendingReason;
        task.pendingReason = null;

        if (disposed || !task.enabled) return;
        if (shouldPause(task)) return;
        if (pendingReason) {
          void runTask(task, pendingReason);
          return;
        }
        scheduleTask(task, task.intervalMs);
      }
    }

    function handleVisibilityChange() {
      tasks.forEach((task) => {
        if (!task.enabled) return;
        if (document.hidden) {
          clearTaskTimer(task);
          return;
        }
        if (task.runImmediatelyOnResume === false) {
          scheduleTask(task, task.intervalMs);
          return;
        }
        void runTask(task, 'visible');
      });
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      global.removeEventListener('beforeunload', dispose);
      tasks.forEach((task) => {
        task.enabled = false;
        clearTaskTimer(task);
      });
      tasks.clear();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    global.addEventListener('beforeunload', dispose);

    return {
      createTask(options = {}) {
        const task = {
          callback: typeof options.callback === 'function' ? options.callback : noop,
          enabled: false,
          intervalMs: Math.max(0, Number(options.intervalMs) || 0),
          pendingReason: null,
          runImmediatelyOnResume: options.runImmediatelyOnResume !== false,
          running: false,
          timerId: null,
          visibleOnly: options.visibleOnly !== false,
        };

        tasks.add(task);

        return {
          start(startOptions = {}) {
            const { immediate = true } = startOptions;
            task.enabled = true;
            if (immediate) {
              void runTask(task, 'start');
              return;
            }
            scheduleTask(task, task.intervalMs);
          },
          stop() {
            task.enabled = false;
            task.pendingReason = null;
            clearTaskTimer(task);
          },
          trigger(reason = 'manual') {
            return runTask(task, reason);
          },
          dispose() {
            this.stop();
            tasks.delete(task);
          },
        };
      },
      dispose,
    };
  }

  global.PagePoller = Object.freeze({
    create: createPagePoller,
  });
})(window);
