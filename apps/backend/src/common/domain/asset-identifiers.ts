import { PackageType } from '@prisma/client';

export const PACKAGE_IDENTIFIER_PATTERN = /^(MAIL\d{6}|CON\d{7}|NCON\d{6}|DG\d{8})$/;
export const CONTAINER_IDENTIFIER_PATTERN = PACKAGE_IDENTIFIER_PATTERN;
export const TRAILER_IDENTIFIER_PATTERN = /^TRLR\d{6}$/;

const TYPE_BY_PREFIX: ReadonlyArray<readonly [string, PackageType]> = [
  ['MAIL', PackageType.MAIL],
  ['NCON', PackageType.NON_CONVEYABLE],
  ['CON', PackageType.CONVEYABLE],
  ['DG', PackageType.DANGEROUS_GOODS],
];

export function packageTypeFromIdentifier(identifier: string): PackageType {
  const match = TYPE_BY_PREFIX.find(([prefix]) => identifier.startsWith(prefix));

  if (!match) {
    throw new Error(`Unsupported package-type prefix: ${identifier}`);
  }

  return match[1];
}
