import { isNonEmptyString } from '@sniptt/guards';
import { clsx } from 'clsx';
import { type MouseEvent } from 'react';

import { getSafeUrl } from '@ui/utilities/utils/getSafeUrl';

import styles from './RoundedLink.module.scss';

type RoundedLinkAccent = 'gold';

type RoundedLinkProps = {
  href: string;
  label?: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  className?: string;
  accent?: RoundedLinkAccent;
};

export const RoundedLink = ({
  label,
  href,
  onClick,
  className,
  accent,
}: RoundedLinkProps) => {
  if (!isNonEmptyString(label)) {
    return <></>;
  }

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    onClick?.(event);
  };

  return (
    <a
      href={getSafeUrl(href)}
      target="_blank"
      rel="noreferrer"
      onClick={handleClick}
      className={clsx(
        styles.root,
        accent === 'gold' && styles.accentGold,
        className,
      )}
    >
      {label}
    </a>
  );
};
