import { Button } from "./Button";
import { Modal } from "./Modal";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "info",
  confirmVariant = "solid",
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      title={title}
      footer={(
        <>
          <Button variant="outline" tone="neutral" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={confirmVariant} tone={confirmTone} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
    >
      <div className="p-4">
        {description ? <p className="mt-1.5 text-xs text-slate-500">{description}</p> : null}
      </div>
    </Modal>
  );
}
