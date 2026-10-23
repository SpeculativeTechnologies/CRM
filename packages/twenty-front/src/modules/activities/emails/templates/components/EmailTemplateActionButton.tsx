import { Button } from 'twenty-ui/primitives/input';

type EmailTemplateActionButtonProps = {
  title: string;
  disabled?: boolean;
  variant?: 'primary';
  size?: 'small';
  onClick: () => void;
};

export const EmailTemplateActionButton = ({
  title,
  disabled,
  variant,
  onClick,
}: EmailTemplateActionButtonProps) => (
  <Button
    type="button"
    size="sm"
    disabled={disabled}
    variant={variant === 'primary' ? 'solid' : 'outline'}
    color={variant === 'primary' ? 'accent' : 'neutral'}
    onClick={onClick}
  >
    {title}
  </Button>
);
