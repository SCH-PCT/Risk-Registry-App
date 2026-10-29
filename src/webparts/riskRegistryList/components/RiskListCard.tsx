import * as React from 'react';
import { Icon } from '@fluentui/react';

import { IRiskRegistryItem } from '../../../models/domain/IRiskRegistryItem';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { mapPriorityRatingToTier, RiskSeverityTier } from '../../../utilities/riskPriorityTier';
import { mapRiskStatusToStep } from '../../../utilities/riskStatusStep';
import { asPerson, asText, formatShortDate, initialsFor, statusToneFor } from './riskListPresentation';
import styles from './RiskListCard.module.scss';

export interface IRiskListCardProps {
  readonly item: IRiskRegistryItem;
  /** `undefined` when no Detail page URL is configured — the card renders without a link. */
  readonly detailUrl: string | undefined;
  /**
   * Absolute URL of the host web, used to build the Accountable Executive's
   * photo via SharePoint's classic `userphoto.aspx` endpoint — chosen over
   * Microsoft Graph's photo endpoint because this solution requests no Graph
   * API permissions, and `userphoto.aspx` needs none (no tenant-admin
   * consent to add).
   */
  readonly webAbsoluteUrl: string;
}

const STEP_LABELS: readonly string[] = ['Intake', 'Evaluation', 'Assignment', 'Action'];

/** Static lookup (not a dynamic `styles[key]` index) so the CSS module's generated typings keep checking each key. */
const TIER_CARD_CLASS: Readonly<Record<RiskSeverityTier, string>> = {
  1: styles.tierCritical,
  2: styles.tierHigh,
  3: styles.tierModerate,
  4: styles.tierLow
};

const StepProgress: React.FC<{ readonly riskStatus: string | undefined }> = ({ riskStatus }) => {
  const { stepNumber, isTerminal } = mapRiskStatusToStep(riskStatus);

  return (
    <div className={styles.stepProgress}>
      {STEP_LABELS.map((label, index) => {
        const step = index + 1;
        const isComplete = isTerminal ? true : step < stepNumber;
        const isActive = !isTerminal && step === stepNumber;

        return (
          <React.Fragment key={label}>
            {index > 0 && <span className={styles.stepDivider}>/</span>}
            <span
              className={[styles.stepLabel, isComplete && styles.stepComplete, isActive && styles.stepActive]
                .filter(Boolean)
                .join(' ')}
            >
              {isComplete && <Icon iconName="CheckMark" aria-hidden="true" className={styles.stepIcon} />}
              {isActive && <span className={styles.stepPulse} aria-hidden="true" />}
              {label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/**
 * One risk record card, matching the design's full-width incident row.
 *
 * Every badge/line maps to a real `RiskRegistryData` field (or a system
 * field like `Created`/`Author`) — see `riskListPresentation.ts` for the
 * mapping logic. A field that is unset omits the UI piece it would drive
 * rather than showing a placeholder.
 */
export const RiskListCard: React.FC<IRiskListCardProps> = ({ item, detailUrl, webAbsoluteUrl }) => {
  const { fields } = item;

  const [photoFailed, setPhotoFailed] = React.useState(false);

  const riskTitleText = asText(fields.title);
  const riskStatus = asText(fields.riskStatus);
  const riskPriorityRating = asText(fields.riskPriorityRating);
  const hasHarm = asText(fields.hasHarmToPatientVisitorWorkforce);
  const capStatus = asText(fields.capStatus);
  const category = asText(fields.anticipatedResourceForCorrection);
  const unit = asText(fields.microSystem) ?? asText(fields.mesoSystem) ?? asText(fields.assignedToDepartment);
  const executive = asPerson(fields.accountableExecutive);
  const assignedTo = asPerson(fields.evaluatorAssigned);

  const title = riskTitleText ?? `Risk ${item.id}`;
  const tier = mapPriorityRatingToTier(riskPriorityRating);
  const hasHarmFlag = hasHarm === 'Yes';

  const executivePhotoUrl =
    executive?.email && webAbsoluteUrl
      ? `${webAbsoluteUrl.replace(/\/$/, '')}/_layouts/15/userphoto.aspx?size=M&accountname=${encodeURIComponent(executive.email)}`
      : undefined;

  const metaParts = [category, unit].filter((value): value is string => value !== undefined && value.length > 0);
  const submittedDate = formatShortDate(item.created);

  // Routed on the system `id`, matching the Detail web part's own
  // `?id=` contract (see `itemIdentifier.ts`) — not `riskId`, which is an
  // optional, non-unique business field.
  const detailHref = detailUrl ? `${detailUrl}${detailUrl.indexOf('?') === -1 ? '?' : '&'}id=${item.id}` : undefined;
  const isClickable = detailHref !== undefined;

  const handleClick = (): void => {
    if (detailHref) {
      window.location.assign(detailHref);
    }
  };

  // The title's own `<a>` already navigates on click — stop the event from
  // also reaching the card's `onClick` above, or a modifier-key click
  // (ctrl/cmd-click to open a new tab, etc.) would be clobbered by the
  // card's plain same-tab `window.location.assign`.
  const handleTitleLinkClick = (event: React.MouseEvent): void => event.stopPropagation();

  const handleCopyId = (event: React.MouseEvent): void => {
    event.stopPropagation();
    navigator.clipboard?.writeText(String(item.id)).catch(() => {
      // Best-effort convenience copy — a failure here has no state anything else depends on.
    });
  };

  return (
    <div
      className={[styles.card, tier && TIER_CARD_CLASS[tier.tier], isClickable && styles.clickable].filter(Boolean).join(' ')}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? 'link' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      <div className={styles.main}>
        <div className={styles.badgeRow}>
          <span className={styles.riskCode}>
            ID: {item.id}
            <Icon iconName="Copy" aria-hidden="true" className={styles.copyIcon} onClick={handleCopyId} title="Copy ID" />
          </span>
          {tier && <span className={[styles.tierBadge, TIER_CARD_CLASS[tier.tier]].join(' ')}>{tier.label}</span>}
          {hasHarmFlag && (
            <span className={styles.harmBadge}>
              <Icon iconName="Warning" aria-hidden="true" />
              Harm Flag
            </span>
          )}
          {riskStatus && <StatusBadge text={riskStatus} tone={statusToneFor(riskStatus)} />}
          {capStatus && <span className={styles.capStatusBadge}>CAP: {capStatus}</span>}
        </div>

        <h3 className={styles.title}>
          {detailHref ? (
            <a href={detailHref} className={styles.titleLink} onClick={handleTitleLinkClick}>
              {title}
            </a>
          ) : (
            title
          )}
        </h3>

        {metaParts.length > 0 && (
          <div className={styles.metaRow}>
            <Icon iconName="Health" aria-hidden="true" className={styles.metaIcon} />
            <span>{metaParts.join(' • ')}</span>
          </div>
        )}

        {(item.submittedBy || submittedDate) && (
          <div className={styles.submittedRow}>
            {item.submittedBy && (
              <span>
                Submitted by <strong>{item.submittedBy.displayName}</strong>
              </span>
            )}
            {item.submittedBy && submittedDate && <span> on </span>}
            {submittedDate && <span>{submittedDate}</span>}
          </div>
        )}

        {assignedTo && (
          <div className={styles.submittedRow}>
            <span>
              Assigned to <strong>{assignedTo.displayName}</strong>
            </span>
          </div>
        )}
      </div>

      <div className={styles.side}>
        <StepProgress riskStatus={riskStatus} />

        {executive && (
          <div className={styles.executive}>
            <span className={styles.avatar} aria-hidden="true">
              {executivePhotoUrl && !photoFailed ? (
                <img
                  src={executivePhotoUrl}
                  alt=""
                  className={styles.avatarImg}
                  onError={() => setPhotoFailed(true)}
                />
              ) : (
                initialsFor(executive.displayName)
              )}
            </span>
            <div className={styles.executiveText}>
              <span className={styles.executiveName}>{executive.displayName}</span>
              <span className={styles.executiveRole}>Accountable Executive</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskListCard;
