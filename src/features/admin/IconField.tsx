import { Button, Caption1, Field, Input, Spinner, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowUndoRegular, ImageAddRegular } from "@fluentui/react-icons";
import { useRef, useState } from "react";
import { ShopIcon } from "@/features/shop/ShopIcon";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DATA_URL = 140_000;

const useStyles = makeStyles({
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalL,
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    flexGrow: 1,
    minWidth: 0,
  },
  buttons: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
  },
  hint: {
    color: tokens.colorNeutralForeground3,
  },
  preview: {
    marginTop: "26px",
  },
});

async function resizeIcon(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    for (const size of [256, 160, 96]) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        break;
      }
      const scale = Math.max(size / bitmap.width, size / bitmap.height);
      const width = bitmap.width * scale;
      const height = bitmap.height * scale;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
      let url = canvas.toDataURL("image/webp", 0.86);
      if (!url.startsWith("data:image/webp")) {
        url = canvas.toDataURL("image/png");
      }
      if (url.length <= MAX_DATA_URL) {
        return url;
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error("too large");
}

export function IconField({
  value,
  name,
  error,
  onChange,
}: {
  value: string;
  name: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const styles = useStyles();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploaded = value.startsWith("data:");
  const message = uploadError ?? error;

  async function onFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setUploadError(null);
    if (file.size > MAX_FILE_BYTES) {
      setUploadError("图片不能超过 10 MB");
      return;
    }
    setBusy(true);
    try {
      onChange(await resizeIcon(file));
    } catch {
      setUploadError("无法读取这张图片，请换一张 PNG、JPEG 或 WebP 图片");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.row}>
      <ShopIcon icon={value} name={name || "店"} size={64} className={styles.preview} />
      <div className={styles.controls}>
        <Field
          label="店铺图标"
          validationState={message ? "error" : "none"}
          validationMessage={message ?? undefined}
        >
          <Input
            value={uploaded ? "" : value}
            placeholder={uploaded ? "已上传图片" : "emoji、1–2 个字，或图片链接"}
            onChange={(_e, data) => {
              setUploadError(null);
              onChange(data.value);
            }}
          />
        </Field>
        <div className={styles.buttons}>
          <Button
            size="small"
            icon={busy ? <Spinner size="extra-tiny" /> : <ImageAddRegular />}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            上传图片
          </Button>
          {value ? (
            <Button
              size="small"
              appearance="subtle"
              icon={<ArrowUndoRegular />}
              onClick={() => {
                setUploadError(null);
                onChange("");
              }}
            >
              恢复默认
            </Button>
          ) : null}
        </div>
        <Caption1 className={styles.hint}>留空则使用默认头像。上传的图片会裁成正方形，同时用作浏览器标签页图标。</Caption1>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
