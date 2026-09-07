import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, authApi, type Category, type Me } from '../api/client';
import { serverErrorMessage } from '../i18n';
import CategoryIcon, {
  DEFAULT_CATEGORY_ICON_NAME,
  resolveCategoryIconName,
} from '../components/CategoryIcon';
import IconPicker from '../components/IconPicker';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface CategoriesProps {
  me: Me;
  onLogout: () => void;
}

export default function Categories({ me, onLogout }: CategoriesProps) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState(DEFAULT_CATEGORY_ICON_NAME);
  const [formType, setFormType] = useState<'Numeric' | 'Text'>('Numeric');
  const [formFixedText, setFormFixedText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [restoringName, setRestoringName] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const [showReorder, setShowReorder] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [reorderError, setReorderError] = useState('');

  useEffect(() => {
    authApi
      .allCategories()
      .then(setCategories)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          setCategories([]);
          return;
        }
        setError(serverErrorMessage(err) || t('errors.couldNotLoad', { resource: t('categories.title') }));
      });
  }, [t]);

  useEffect(() => {
    if (!showForm && !toDelete && !showReorder) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setShowForm(false);
      setEditing(null);
      setToDelete(null);
      setShowReorder(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showForm, toDelete, showReorder]);

  function openCreate() {
    setEditing(null);
    setFormName('');
    setFormIcon(DEFAULT_CATEGORY_ICON_NAME);
    setFormType('Numeric');
    setFormFixedText('');
    setFormError('');
    setShowForm(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setFormName(cat.name);
    setFormIcon(resolveCategoryIconName(cat.iconName));
    setFormType(cat.categoryType.type);
    setFormFixedText(cat.fixedText ?? '');
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = formName.trim();
    const iconName = formIcon.trim();
    if (!name || !iconName || submitting) return;
    setFormError('');
    setSubmitting(true);

    const categoryType = { type: formType } as Category['categoryType'];
    const body: Category = {
      name,
      iconName,
      categoryType,
      deleted: false,
    };
    if (formFixedText.trim()) {
      body.fixedText = formFixedText.trim();
    }

    try {
      if (editing) {
        await authApi.updateCategory(editing.name, body);
        setCategories((prev) =>
          prev
            ? prev.map((c) => (c.name === editing.name ? { ...body, deleted: c.deleted } : c))
            : prev
        );
      } else {
        await authApi.createCategory(body);
        setCategories((prev) => (prev ? [...prev, body] : [body]));
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFormError(t('errors.unauthorized'));
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setFormError(t('categories.alreadyExists'));
        return;
      }
      setFormError(
        serverErrorMessage(err) || (editing ? t('categories.updateFailed') : t('categories.createFailed'))
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleDelete() {
    if (!toDelete || deleting) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await authApi.deleteCategory(toDelete.name);
      setCategories((prev) =>
        prev
          ? prev.map((c) => (c.name === toDelete.name ? { ...c, deleted: !c.deleted } : c))
          : prev
      );
      setToDelete(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setDeleteError(t('errors.unauthorized'));
        return;
      }
      setDeleteError(serverErrorMessage(err) || t('categories.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  function openReorder() {
    const activeCategories = (categories ?? [])
      .filter((c) => !c.deleted)
      .slice()
      .sort(
        (a, b) =>
          (a.categoryOrder ?? Infinity) - (b.categoryOrder ?? Infinity) ||
          a.name.localeCompare(b.name)
      );
    setOrder(activeCategories.map((c) => c.name));
    setReorderError('');
    setShowReorder(true);
  }

  async function handleSaveOrder() {
    if (savingOrder) return;
    setReorderError('');
    setSavingOrder(true);
    try {
      await authApi.reorderCategories(order);
      setShowReorder(false);
      const fresh = await authApi.allCategories();
      setCategories(fresh);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setReorderError(t('errors.unauthorized'));
        return;
      }
      setReorderError(serverErrorMessage(err) || t('categories.reorderFailed'));
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Session is cleared client-side regardless.
    }
    onLogout();
  }

  const all = categories ?? [];
    /* const active = all.filter((c) => !c.deleted).sort((a, b) => a.name.localeCompare(b.name)); */
  const active = all.filter((c) => !c.deleted);
  const deleted = all.filter((c) => c.deleted).sort((a, b) => a.name.localeCompare(b.name));
  const byName = new Map(all.map((c) => [c.name, c] as const));

  return (
    <div className="view">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="breadcrumb">
            <span className="breadcrumb-current">{t('nav.categories')}</span>
          </div>
          <div className="user-area">
            <LanguageSwitcher />
            <span className="user-name">{me.name}</span>
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              {t('nav.logOut')}
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="section-head section-head-row">
          <div>
            <h2>{t('categories.title')}</h2>
            <p className="section-subtitle">
              {categories === null
                ? t('common.loading')
                : t('categories.count', { count: active.length })}
            </p>
          </div>
          <div className="section-head-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={openReorder}
              disabled={categories === null || active.length < 2}
            >
              {t('categories.reorder')}
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              {t('categories.newCategory')}
            </button>
          </div>
        </div>
        {error && <div className="error app-error">{error}</div>}
        {categories === null ? (
          <p className="section-subtitle">{t('common.loading')}</p>
        ) : active.length === 0 ? (
          <p className="empty-state">
            {deleted.length > 0 ? t('categories.noActive') : t('categories.empty')}
          </p>
        ) : (
          <ul className="operator-list">
            {active.map((cat) => (
              <li key={cat.name} className="operator-item">
                <CategoryIcon iconName={cat.iconName} size={18} />
                <span className="operator-name">{cat.name}</span>
                <span className="category-type-badge">
                  {cat.categoryType.type === 'Numeric' ? t('categories.typeNumeric') : t('categories.typeText')}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  title={t('categories.edit')}
                  aria-label={t('categories.edit')}
                  onClick={() => openEdit(cat)}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  title={t('categories.delete')}
                  aria-label={t('categories.delete')}
                  onClick={() => {
                    setDeleteError('');
                    setToDelete(cat);
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        {deleted.length > 0 && (
          <section className="deleted-section" aria-label={t('categories.deletedSection')}>
            <div className="section-head section-head-row">
              <div>
                <h3 className="deleted-section-title">{t('categories.deletedSection')}</h3>
                <p className="section-subtitle">
                  {t('categories.deletedCount', { count: deleted.length })}
                </p>
              </div>
            </div>
            {restoreError && <div className="error app-error">{restoreError}</div>}
            <ul className="operator-list">
              {deleted.map((cat) => (
                <li key={cat.name} className="operator-item operator-item-deleted">
                  <CategoryIcon iconName={cat.iconName} size={18} />
                  <span className="operator-name">{cat.name}</span>
                  <span className="operator-deleted-tag">{t('categories.deletedTag')}</span>
                  <button
                    type="button"
                    className="icon-btn icon-btn-accent"
                    title={t('categories.restore')}
                    aria-label={t('categories.restore')}
                    disabled={restoringName !== null}
                    onClick={async () => {
                      setRestoreError('');
                      setRestoringName(cat.name);
                      try {
                          await authApi.restoreCategory(cat.name);
                        const fresh = await authApi.allCategories();
                        setCategories(fresh);
                      } catch (err) {
                          if (err instanceof ApiError && err.status === 401) {
                              setRestoreError(t('errors.unauthorized'));
                              return;
                          }
                          setRestoreError(
                              serverErrorMessage(err) || t('categories.restoreFailed')
                          );
                      } finally {
                        setRestoringName(null);
                      }
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {showForm && (
          <div className="modal-backdrop" onClick={() => { setShowForm(false); setEditing(null); }}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="category-form-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="category-form-title" className="modal-title">
                {editing ? t('categories.edit') : t('categories.newCategory')}
              </h3>
              <form onSubmit={handleSubmit}>
                <label className="field">
                  <span>{t('categories.name')}</span>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('categories.namePlaceholder')}
                    autoFocus
                    disabled={submitting}
                    required
                  />
                </label>
                <label className="field">
                  <span>{t('categories.iconName')}</span>
                  <IconPicker
                    value={formIcon}
                    onChange={setFormIcon}
                    disabled={submitting}
                  />
                </label>
                <label className="field">
                  <span>{t('categories.categoryType')}</span>
                  <select
                    className="field-select"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as 'Numeric' | 'Text')}
                    disabled={submitting}
                  >
                    <option value="Numeric">{t('categories.typeNumeric')}</option>
                    <option value="Text">{t('categories.typeText')}</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t('categories.fixedText')}</span>
                  <input
                    type="text"
                    value={formFixedText}
                    onChange={(e) => setFormFixedText(e.target.value)}
                    placeholder={t('categories.fixedTextPlaceholder')}
                    disabled={submitting}
                  />
                </label>
                {formError && <p className="error modal-error">{formError}</p>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { setShowForm(false); setEditing(null); }}
                    disabled={submitting}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || !formName.trim() || !formIcon.trim()}
                  >
                    {submitting
                      ? (editing ? t('categories.saving') : t('categories.creating'))
                      : (editing ? t('categories.save') : t('categories.create'))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {toDelete && (
          <div className="modal-backdrop" onClick={() => setToDelete(null)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-category-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="delete-category-title" className="modal-title">
                {t('categories.deleteTitle')}
              </h3>
              <p className="modal-text">{t('categories.deleteConfirm', { name: toDelete.name })}</p>
              {deleteError && <p className="error modal-error">{deleteError}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setToDelete(null)}
                  disabled={deleting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleToggleDelete}
                  disabled={deleting}
                >
                  {deleting ? t('categories.deleting') : t('categories.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
        {showReorder && (
          <div className="modal-backdrop" onClick={() => setShowReorder(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reorder-categories-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="reorder-categories-title" className="modal-title">
                {t('categories.reorderTitle')}
              </h3>
              <p className="modal-text">{t('categories.reorderInstructions')}</p>
              {reorderError && <p className="error modal-error">{reorderError}</p>}
              <ul
                className="reorder-list"
                onDrop={(event) => {
                  event.preventDefault();
                  setDraggedIndex(null);
                }}
                onDragOver={(event) => event.preventDefault()}
              >
                {order.map((name, index) => (
                  <li
                    key={name}
                    className={
                      'reorder-item' + (draggedIndex === index ? ' reorder-item-current' : '')
                    }
                    draggable={!savingOrder}
                    onDragStart={(event) => {
                      setDraggedIndex(index);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', name);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggedIndex === null || draggedIndex === index) {
                        setDraggedIndex(null);
                        return;
                      }
                      setOrder((prev) => {
                        const next = prev.slice();
                        const [moved] = next.splice(draggedIndex, 1);
                        next.splice(index, 0, moved);
                        return next;
                      });
                      setDraggedIndex(null);
                    }}
                    onDragEnd={() => setDraggedIndex(null)}
                  >
                    <CategoryIcon iconName={byName.get(name)?.iconName ?? ''} size={18} />
                    <span className="operator-name">{byName.get(name)?.name ?? name}</span>
                    <svg
                      className="reorder-drag-handle"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="9" cy="6" r="1" />
                      <circle cx="15" cy="6" r="1" />
                      <circle cx="9" cy="12" r="1" />
                      <circle cx="15" cy="12" r="1" />
                      <circle cx="9" cy="18" r="1" />
                      <circle cx="15" cy="18" r="1" />
                    </svg>
                  </li>
                ))}
              </ul>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowReorder(false)}
                  disabled={savingOrder}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveOrder}
                  disabled={savingOrder}
                >
                  {savingOrder ? t('categories.reordering') : t('categories.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
