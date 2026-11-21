/**
 * 撤回 / 恢复：每一次「可以反悔」的改动（换风格、拖滑块、加减细节、选部位、换版本、换照片…）都记一笔快照。
 * 快照是可以 JSON 序列化的普通对象，所以撤回记录也能跟着草稿存下来，刷新后照样能撤回。
 *
 *   const u = createUndo({ snapshot, restore })
 *   ...改了点什么... u.commit('换成「梦幻公主」')
 *   u.undo() → 返回被撤回的那一步叫什么（给提示条用）
 */
/** @template S @typedef {{ state: S, label: string }} Step */

/**
 * @template S
 * @param {{ snapshot: () => S, restore: (s: S) => void, limit?: number, onChange?: () => void }} o
 */
export function createUndo(o) {
  const limit = o.limit || 50;
  const snap = () => structuredClone(o.snapshot());
  /** @type {Step<S>[]} */ let past = [];
  /** @type {Step<S>[]} */ let future = [];
  let base = snap();
  const key = (/** @type {S} */ s) => JSON.stringify(s);
  const changed = () => o.onChange?.();
  return {
    /** 改完之后调用一次；和上一个快照一样就不记。 @param {string} label */
    commit(label) {
      const now = snap();
      if (key(now) === key(base)) return false;
      past.push({ state: base, label });
      if (past.length > limit) past.shift();
      future = [];
      base = now;
      changed();
      return true;
    },
    /** @returns {string | null} 撤回了哪一步 */
    undo() {
      const step = past.pop();
      if (!step) return null;
      future.push({ state: base, label: step.label });
      base = step.state;
      o.restore(structuredClone(base));
      changed();
      return step.label;
    },
    /** @returns {string | null} 恢复了哪一步 */
    redo() {
      const step = future.pop();
      if (!step) return null;
      past.push({ state: base, label: step.label });
      base = step.state;
      o.restore(structuredClone(base));
      changed();
      return step.label;
    },
    /** 不记录地对齐到当前状态（例如程序自己改了状态，不该成为一步）。 */
    rebase() { base = snap(); },
    /** 清空（换了一张全新的照片时）。 */
    clear() { past = []; future = []; base = snap(); changed(); },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    get nextUndo() { return past.at(-1)?.label || ''; },
    get nextRedo() { return future.at(-1)?.label || ''; },
    /** 存档 / 读档（跟着草稿走）。 */
    dump() { return { past: past.slice(-30), future: future.slice(-30) }; },
    /** @param {{ past?: Step<S>[], future?: Step<S>[] } | null | undefined} d */
    load(d) { past = (d?.past || []).slice(-limit); future = (d?.future || []).slice(-limit); base = snap(); changed(); },
  };
}
