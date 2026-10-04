import { isNonEmptyString } from '@sniptt/guards';
import { styled } from '@linaria/react';
import { type MouseEvent } from 'react';

import { getSafeUrl } from 'twenty-ui/utilities';

const StyledLink = styled.a`
  align-items: center;
  background-color: var(--t-background-transparent-lighter);
  border: 1px solid var(--t-border-color-strong);
  border-radius: var(--t-border-radius-pill);
  box-sizing: content-box;
  color: var(--t-font-color-primary);
  corner-shape: round;
  cursor: pointer;
  display: inline-flex;
  font-weight: var(--t-font-size-md);
  gap: var(--t-spacing-1);
  height: 10px;
  justify-content: center;
  max-width: calc(100% - var(--t-spacing-multiplicator) * 2px);
  min-width: fit-content;
  overflow: hidden;
  padding: var(--t-spacing-1) var(--t-spacing-2);
  text-decoration: none;
  text-overflow: ellipsis;
  user-select: none;
  white-space: nowrap;

  &[data-color='secondary'] {
    color: var(--t-font-color-secondary);
  }

  // The gold accent marks the primary email. The amber scale carries the gold
  // hue in both color schemes, where a single stored color could not.
  &[data-accent='gold'] {
    background-color: var(--t-color-yellow3);
    border-color: var(--t-color-yellow6);
    color: var(--t-color-yellow11);
  }

  &:hover {
    background-color: var(--t-background-transparent-light);
  }

  &:active {
    background-color: var(--t-background-transparent-medium);
  }
`;

type RoundedLinkAccent = 'gold';

type RoundedLinkProps = {
  href: string;
  label?: string;
  color?: 'primary' | 'secondary';
  accent?: RoundedLinkAccent;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  className?: string;
};

export const RoundedLink = ({
  label,
  href,
  color = 'primary',
  accent,
  onClick,
  className,
}: RoundedLinkProps) => {
  if (!isNonEmptyString(label)) {
    return <></>;
  }

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    onClick?.(event);
  };

  return (
    <StyledLink
      href={getSafeUrl(href)}
      target="_blank"
      rel="noreferrer"
      onClick={handleClick}
      data-color={color}
      data-accent={accent}
      className={className}
    >
      {label}
    </StyledLink>
  );
};
