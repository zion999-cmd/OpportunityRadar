import { useEffect, useState } from 'react';
import { saveSituation } from '../api.js';
import { useAppData } from '../app-data.js';

interface SituationModalProps {
  readonly onClose: () => void;
}

// Modal editor for the single job-seeking Situation. Save goes
// through the existing PUT /api/situation; nothing else in the
// observation runtime is touched.
export function SituationModal({ onClose }: SituationModalProps): JSX.Element {
  const { situation, setSituation, showToast } = useAppData();
  const [text, setText] = useState(situation?.rawText ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSave(): Promise<void> {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setError('Situation 不能为空。');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await saveSituation(trimmed);
      setSituation(next);
      showToast('Situation 已保存');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="编辑我的 Situation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <h3>我的 Situation</h3>
        <p className="hint">
          我有这些经历 / 能力，世界哪里正在需要我？如实描述你的经历与当下处境，Observation 只围绕它恢复关系。
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：我做过多年企业软件和后端系统……"
          autoFocus
        />
        {error !== null && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>{error}</p>}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
