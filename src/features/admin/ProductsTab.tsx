import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Spinner,
  SpinButton,
  Switch,
  Textarea,
  Tooltip,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
} from "@fluentui/react-components";
import { AddRegular, BoxRegular, DeleteRegular, EditRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useState } from "react";
import { createProduct, deleteProduct, listProducts, updateProduct, type Product } from "@/api";
import { EmptyState, Section } from "@/components/ui";
import { formatYuan } from "@/lib/format";
import { charCount, fieldErrors, spinValue, useAdmin } from "./context";

type Draft = Omit<Product, "id">;

const EMPTY_PRODUCT: Draft = { name: "", description: "", price: 18, enabled: true, sort_order: 0 };

const useStyles = makeStyles({
  list: {
    display: "flex",
    flexDirection: "column",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    ...shorthands.padding(tokens.spacingVerticalM, 0),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke2),
    ":first-child": {
      ...shorthands.borderTop("0", "none", "transparent"),
      paddingTop: 0,
    },
    ":last-child": {
      paddingBottom: 0,
    },
  },
  rowText: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flexGrow: 1,
    minWidth: 0,
  },
  rowTitle: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
  },
  name: {
    fontWeight: tokens.fontWeightSemibold,
    overflowWrap: "anywhere",
  },
  desc: {
    color: tokens.colorNeutralForeground3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  price: {
    flexShrink: 0,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums",
  },
  rowActions: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  dimmed: {
    opacity: 0.6,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  pair: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalM,
  },
  loading: {
    ...shorthands.padding(tokens.spacingVerticalXXL, 0),
  },
});

export function ProductsTab() {
  const styles = useStyles();
  const { notify, fail } = useAdmin();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<{ id: number | null; draft: Draft } | null>(null);
  const [removing, setRemoving] = useState<Product | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  const reload = useCallback(async () => {
    try {
      setProducts(await listProducts());
    } catch (caught) {
      fail(caught, "商品加载失败");
    }
  }, [fail]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onToggle(item: Product, enabled: boolean) {
    setToggling(item.id);
    try {
      const { id, ...rest } = item;
      await updateProduct(id, { ...rest, enabled });
      setProducts((prev) => prev?.map((p) => (p.id === id ? { ...p, enabled } : p)) ?? prev);
      notify("success", enabled ? `「${item.name}」已上架` : `「${item.name}」已下架`);
    } catch (caught) {
      fail(caught, "更新失败");
    } finally {
      setToggling(null);
    }
  }

  const addButton = (
    <Button appearance="primary" icon={<AddRegular />} onClick={() => setEditing({ id: null, draft: EMPTY_PRODUCT })}>
      添加商品
    </Button>
  );

  return (
    <>
      <Section
        title="商品"
        description={products ? `共 ${products.length} 件，按排序值从小到大展示` : undefined}
        action={products && products.length > 0 ? addButton : undefined}
      >
        {products === null ? <Spinner className={styles.loading} label="正在加载商品" /> : null}
        {products && products.length === 0 ? (
          <EmptyState
            icon={<BoxRegular />}
            title="还没有商品"
            description="添加商品后，访客可以在付款页直接选择购买。"
            action={addButton}
          />
        ) : null}
        {products && products.length > 0 ? (
          <div className={styles.list}>
            {products.map((item) => (
              <div className={styles.row} key={item.id}>
                <div className={mergeClasses(styles.rowText, !item.enabled && styles.dimmed)}>
                  <div className={styles.rowTitle}>
                    <Body1 className={styles.name}>{item.name}</Body1>
                    {!item.enabled ? (
                      <Badge appearance="tint" color="informative" size="small">
                        已下架
                      </Badge>
                    ) : null}
                  </div>
                  {item.description ? <Caption1 className={styles.desc}>{item.description}</Caption1> : null}
                </div>
                <Body1 className={styles.price}>{formatYuan(item.price)}</Body1>
                <div className={styles.rowActions}>
                  <Tooltip content={item.enabled ? "在售，点击下架" : "已下架，点击上架"} relationship="description">
                    <Switch
                      aria-label={`${item.name} 在售`}
                      checked={item.enabled}
                      disabled={toggling === item.id}
                      onChange={(_e, data) => void onToggle(item, data.checked)}
                    />
                  </Tooltip>
                  <Tooltip content="编辑" relationship="label">
                    <Button
                      appearance="subtle"
                      icon={<EditRegular />}
                      onClick={() => {
                        const { id, ...draft } = item;
                        setEditing({ id, draft });
                      }}
                    />
                  </Tooltip>
                  <Tooltip content="删除" relationship="label">
                    <Button appearance="subtle" icon={<DeleteRegular />} onClick={() => setRemoving(item)} />
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Section>

      <ProductEditor
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={async (created) => {
          setEditing(null);
          notify("success", created ? "商品已添加" : "商品已保存");
          await reload();
        }}
      />

      <Dialog open={removing !== null} onOpenChange={(_e, data) => !data.open && setRemoving(null)}>
        <DialogSurface style={{ maxWidth: 420 }}>
          <DialogBody>
            <DialogTitle>删除「{removing?.name}」？</DialogTitle>
            <DialogContent>删除后无法恢复。只是暂时不卖的话，可以改为下架。</DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setRemoving(null)}>
                取消
              </Button>
              <DeleteButton
                onConfirm={async () => {
                  if (!removing) {
                    return;
                  }
                  try {
                    await deleteProduct(removing.id);
                    notify("success", `「${removing.name}」已删除`);
                    setRemoving(null);
                    await reload();
                  } catch (caught) {
                    fail(caught, "删除失败");
                  }
                }}
              />
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      appearance="primary"
      icon={busy ? <Spinner size="tiny" /> : <DeleteRegular />}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void onConfirm().finally(() => setBusy(false));
      }}
    >
      删除
    </Button>
  );
}

function ProductEditor({
  editing,
  onClose,
  onSaved,
}: {
  editing: { id: number | null; draft: Draft } | null;
  onClose: () => void;
  onSaved: (created: boolean) => Promise<void>;
}) {
  const styles = useStyles();
  const { fail } = useAdmin();
  const [draft, setDraft] = useState<Draft>(EMPTY_PRODUCT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setDraft(editing.draft);
      setErrors({});
    }
  }, [editing]);

  const update = (patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    const cleared = { ...errors };
    for (const key of Object.keys(patch)) {
      delete cleared[key];
    }
    setErrors(cleared);
  };

  const error = (key: keyof Draft) =>
    errors[key] ? { validationState: "error" as const, validationMessage: errors[key] } : {};

  async function onSave() {
    if (!editing) {
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      if (editing.id === null) {
        await createProduct(draft);
      } else {
        await updateProduct(editing.id, draft);
      }
      await onSaved(editing.id === null);
    } catch (caught) {
      const perField = fieldErrors(caught);
      setErrors(perField);
      if (Object.keys(perField).length === 0) {
        fail(caught, "保存失败");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={editing !== null} onOpenChange={(_e, data) => !data.open && onClose()}>
      <DialogSurface style={{ maxWidth: 480, width: "calc(100vw - 32px)" }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onSave();
          }}
        >
          <DialogBody>
            <DialogTitle>{editing?.id === null ? "添加商品" : "编辑商品"}</DialogTitle>
            <DialogContent className={styles.form}>
              <Field label="名称" required hint={charCount(draft.name, 40)} {...error("name")}>
                <Input value={draft.name} maxLength={40} autoFocus onChange={(_e, data) => update({ name: data.value })} />
              </Field>
              <Field label="说明" hint={charCount(draft.description, 200)} {...error("description")}>
                <Textarea
                  value={draft.description}
                  maxLength={200}
                  resize="vertical"
                  onChange={(_e, data) => update({ description: data.value })}
                />
              </Field>
              <div className={styles.pair}>
                <Field label="价格（元）" required {...error("price")}>
                  <SpinButton
                    min={0.01}
                    max={10000}
                    value={draft.price}
                    onChange={(_e, data) => {
                      const value = spinValue(data);
                      if (value !== undefined) {
                        update({ price: value });
                      }
                    }}
                  />
                </Field>
                <Field label="排序" hint="越小越靠前" {...error("sort_order")}>
                  <SpinButton
                    min={-999}
                    max={999}
                    step={1}
                    value={draft.sort_order}
                    onChange={(_e, data) => {
                      const value = spinValue(data);
                      if (value !== undefined) {
                        update({ sort_order: Math.round(value) });
                      }
                    }}
                  />
                </Field>
              </div>
              <Switch label="上架销售" checked={draft.enabled} onChange={(_e, data) => update({ enabled: data.checked })} />
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose} disabled={saving}>
                取消
              </Button>
              <Button
                appearance="primary"
                type="submit"
                disabled={saving || draft.name.trim() === ""}
                icon={saving ? <Spinner size="tiny" /> : undefined}
              >
                {editing?.id === null ? "添加" : "保存"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
