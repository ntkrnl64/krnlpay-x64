import {
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  SpinButton,
  Switch,
  Textarea,
  makeStyles,
  shorthands,
  tokens,
} from "@fluentui/react-components";
import { ArrowUndoRegular, SaveRegular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { getSettings, saveSettings, type ShopSettings } from "@/api";
import { Section } from "@/components/ui";
import { charCount, fieldErrors, spinValue, useAdmin } from "./context";
import { IconField } from "./IconField";

const useStyles = makeStyles({
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  pair: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalM,
  },
  switchHint: {
    display: "block",
    color: tokens.colorNeutralForeground3,
    marginTop: "-6px",
    paddingLeft: "44px",
  },
  saveBar: {
    position: "sticky",
    bottom: tokens.spacingVerticalL,
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow16,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS, tokens.spacingVerticalS, tokens.spacingHorizontalL),
  },
  saveHint: {
    color: tokens.colorNeutralForeground3,
  },
  saveActions: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
  },
  loading: {
    ...shorthands.padding(tokens.spacingVerticalXXXL, 0),
  },
});

function presetsToText(presets: number[]): string {
  return presets.join(", ");
}

export function SettingsTab() {
  const styles = useStyles();
  const { notify, fail } = useAdmin();
  const [saved, setSaved] = useState<ShopSettings | null>(null);
  const [draft, setDraft] = useState<ShopSettings | null>(null);
  const [presetsText, setPresetsText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((settings) => {
        if (!cancelled) {
          setSaved(settings);
          setDraft(settings);
          setPresetsText(presetsToText(settings.presets));
        }
      })
      .catch((caught: unknown) => !cancelled && fail(caught, "店铺设置加载失败"));
    return () => {
      cancelled = true;
    };
  }, [fail]);

  if (!draft || !saved) {
    return <Spinner className={styles.loading} label="正在加载店铺设置" />;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || presetsText !== presetsToText(saved.presets);

  const update = (patch: Partial<ShopSettings>) => {
    setDraft({ ...draft, ...patch });
    const cleared = { ...errors };
    for (const key of Object.keys(patch)) {
      delete cleared[key];
    }
    setErrors(cleared);
  };

  const error = (key: keyof ShopSettings) =>
    errors[key] ? { validationState: "error" as const, validationMessage: errors[key] } : {};

  async function onSave() {
    if (!draft) {
      return;
    }
    const presets = presetsText
      .split(/[,，、\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map(Number);
    const next = { ...draft, presets };
    setSaving(true);
    setErrors({});
    try {
      await saveSettings(next);
      setSaved(next);
      setDraft(next);
      setPresetsText(presetsToText(presets));
      notify("success", "店铺设置已保存");
    } catch (caught) {
      const perField = fieldErrors(caught);
      setErrors(perField);
      if (Object.keys(perField).length > 0) {
        notify("error", "有几项需要修改，请检查标红的字段");
      } else {
        fail(caught, "保存失败");
      }
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    if (!saved) {
      return;
    }
    setDraft(saved);
    setPresetsText(presetsToText(saved.presets));
    setErrors({});
  }

  return (
    <form
      className={styles.stack}
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      <Section title="店铺信息" description="显示在付款页的顶部">
        <div className={styles.fields}>
          <Field label="店铺名称" required hint={charCount(draft.shop_name, 40)} {...error("shop_name")}>
            <Input value={draft.shop_name} maxLength={40} onChange={(_e, data) => update({ shop_name: data.value })} />
          </Field>
          <IconField
            value={draft.icon}
            name={draft.shop_name}
            error={errors.icon}
            onChange={(icon) => update({ icon })}
          />
          <Field label="副标题" hint={charCount(draft.tagline, 80)} {...error("tagline")}>
            <Input value={draft.tagline} maxLength={80} onChange={(_e, data) => update({ tagline: data.value })} />
          </Field>
          <Field label="介绍" hint={charCount(draft.about, 1000)} {...error("about")}>
            <Textarea
              value={draft.about}
              maxLength={1000}
              rows={4}
              resize="vertical"
              onChange={(_e, data) => update({ about: data.value })}
            />
          </Field>
          <Field label="付款成功文案" hint={charCount(draft.thank_you, 120)} {...error("thank_you")}>
            <Input
              value={draft.thank_you}
              maxLength={120}
              placeholder="收到了，谢谢。"
              onChange={(_e, data) => update({ thank_you: data.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="金额" description="访客可以直接选择快捷金额，或输入范围内的任意金额">
        <div className={styles.fields}>
          <div>
            <Switch
              label="允许自定义金额"
              checked={draft.custom_enabled}
              onChange={(_e, data) => update({ custom_enabled: data.checked })}
            />
            <Caption1 className={styles.switchHint}>关闭后访客只能购买已上架的商品</Caption1>
          </div>
          <div className={styles.pair}>
            <Field label="最低金额（元）" {...error("custom_min")}>
              <SpinButton
                min={0.01}
                max={10000}
                value={draft.custom_min}
                disabled={!draft.custom_enabled}
                onChange={(_e, data) => {
                  const value = spinValue(data);
                  if (value !== undefined) {
                    update({ custom_min: value });
                  }
                }}
              />
            </Field>
            <Field label="最高金额（元）" {...error("custom_max")}>
              <SpinButton
                min={0.01}
                max={10000}
                value={draft.custom_max}
                disabled={!draft.custom_enabled}
                onChange={(_e, data) => {
                  const value = spinValue(data);
                  if (value !== undefined) {
                    update({ custom_max: value });
                  }
                }}
              />
            </Field>
          </div>
          <Field
            label="快捷金额"
            hint="用逗号分隔，最多 8 个，需落在最低和最高金额之间"
            validationState={errors.presets ? "error" : "none"}
            validationMessage={errors.presets}
          >
            <Input
              value={presetsText}
              disabled={!draft.custom_enabled}
              placeholder="6, 18, 36, 66"
              onChange={(_e, data) => {
                setPresetsText(data.value);
                if (errors.presets) {
                  const rest = { ...errors };
                  delete rest.presets;
                  setErrors(rest);
                }
              }}
            />
          </Field>
        </div>
      </Section>

      <Section title="付款之后">
        <Field
          label="付款成功后跳转"
          hint="付款后先显示回执，3 秒后跳到这里，并附带 order_no 参数；留空则停在回执页。付款链接里的 redirect 参数优先。"
          {...error("success_redirect")}
        >
          <Input
            type="url"
            value={draft.success_redirect}
            placeholder="https://example.com/thanks"
            onChange={(_e, data) => update({ success_redirect: data.value })}
          />
        </Field>
      </Section>

      <MessageBar intent="info">
        <MessageBarBody>支付宝密钥、Turnstile 和管理密码只能通过环境变量配置。</MessageBarBody>
      </MessageBar>

      <div className={styles.saveBar}>
        <Caption1 className={styles.saveHint}>{dirty ? "有未保存的更改" : "所有更改都已保存"}</Caption1>
        <div className={styles.saveActions}>
          {dirty ? (
            <Button appearance="subtle" icon={<ArrowUndoRegular />} disabled={saving} onClick={onReset}>
              撤销
            </Button>
          ) : null}
          <Button
            appearance="primary"
            type="submit"
            icon={saving ? <Spinner size="tiny" /> : <SaveRegular />}
            disabled={!dirty || saving}
          >
            保存
          </Button>
        </div>
      </div>
    </form>
  );
}
