import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, UserSessionInfo } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';

export interface SessionRow {
  sessionId: number;
  device: string;
  browser: string;
  location: string;
  date: string;
  time: string;
  status: string;
  statusClass: 'active' | 'logged-out' | 'expired';
  lastActive: string;
  endedDetail: string;
  current: boolean;
  icon: string;
}

// WHAT THE LOGOUT DIALOG IS FOR

export type PendingSessionLogout =
  | { type: 'one'; session: SessionRow }
  | { type: 'others' };

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss'
})
export class SecurityComponent implements OnInit, OnDestroy {

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  twoFactorEnabled = false;
  hasLoadedTwoFactor = false;
  isUpdatingTwoFactor = false;
  twoFactorError = '';
  twoFactorSuccess = '';

  // TURN OFF 2FA DIALOG

  showDisableTwoFactorDialog = false;
  disableTwoFactorPassword = '';
  showDisableTwoFactorPassword = false;
  disableTwoFactorError = '';

  passwordError = '';
  passwordSuccess = '';
  isUpdatingPassword = false;
  passwordChangedAt: string | null = null;

  // SESSIONS

  activeSessions: SessionRow[] = [];
  historySessions: SessionRow[] = [];

  readonly historyPreviewCount = 5;
  showAllHistory = false;

  // SESSION STATE

  isLoadingSessions = false;
  hasLoadedSessions = false;
  sessionsError = '';
  sessionActionError = '';
  sessionsSuccess = '';
  loggingOutSessionId: number | null = null;
  isLoggingOutOthers = false;

  pendingLogout: PendingSessionLogout | null = null;

  // SUCCESS MESSAGE TIMER (SAME AS SCSS ANIMATION)

  private readonly successMessageDuration = 3000;
  private successMessageTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSessions();
    this.loadTwoFactorSetting();
  }

  ngOnDestroy(): void {
    this.clearSuccessMessageTimer();
  }

  // SHOW SUCCESS MESSAGE FOR 3 SECONDS

  private showSessionsSuccess(message: string): void {
    this.clearSuccessMessageTimer();
    this.sessionsSuccess = message;

    this.successMessageTimer = setTimeout(() => {
      this.sessionsSuccess = '';
      this.successMessageTimer = null;
    }, this.successMessageDuration);
  }

  private clearSuccessMessageTimer(): void {
    if (this.successMessageTimer !== null) {
      clearTimeout(this.successMessageTimer);
      this.successMessageTimer = null;
    }
  }

  // LOAD SESSIONS

  loadSessions(): void {
    this.isLoadingSessions = true;
    this.sessionsError = '';

    this.userService.getSessions().subscribe({
      next: (sessions) => {
        this.isLoadingSessions = false;
        this.hasLoadedSessions = true;

        const rows = sessions.map(session =>
          this.toSessionRow(session)
        );

        // SPLIT ACTIVE AND HISTORY (ALREADY SORTED BY API)

        this.activeSessions = rows.filter(row => row.statusClass === 'active');
        this.historySessions = rows.filter(row => row.statusClass !== 'active');
      },

      error: (error) => {
        this.isLoadingSessions = false;

        this.sessionsError =
          error.error?.message ??
          'Unable to load your sessions. Please try again.';
      }
    });
  }

  get otherActiveSessionCount(): number {
    return this.activeSessions.filter(session => !session.current).length;
  }

  get visibleHistorySessions(): SessionRow[] {
    return this.showAllHistory
      ? this.historySessions
      : this.historySessions.slice(0, this.historyPreviewCount);
  }

  toggleHistory(): void {
    this.showAllHistory = !this.showAllHistory;
  }

  // API DATA TO TABLE ROW

  private toSessionRow(session: UserSessionInfo): SessionRow {
    const loginTime = new Date(session.createdAt);
    const device = session.device || 'Unknown Device';
    const isMobile = /iphone|ipad|android/i.test(device);

    const statusClass =
      session.status === 'Active' ? 'active'
        : session.status === 'Expired' ? 'expired'
          : 'logged-out';

    return {
      sessionId: session.sessionId,
      device: device,
      browser: session.browser || 'Unknown Browser',
      location: this.formatLocation(session.ipAddress),
      date: loginTime.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      time: loginTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      }),
      status:
        statusClass === 'active' ? 'Active'
          : statusClass === 'expired' ? 'Expired'
            : 'Logged out',
      statusClass: statusClass,
      lastActive: session.isCurrent
        ? 'Active now'
        : this.formatLastActive(session.lastActiveAt),
      endedDetail: this.formatEndedDetail(session),
      current: session.isCurrent,
      icon: isMobile ? 'phone.svg' : 'laptop.svg'
    };
  }

  // LAST ACTIVE TEXT

  private formatLastActive(lastActiveAt: string): string {
    const minutes = Math.floor(
      (Date.now() - new Date(lastActiveAt).getTime()) / 60000
    );

    if (minutes < 2) {
      return 'Active now';
    }

    if (minutes < 60) {
      return `Active ${minutes} minutes ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return hours === 1 ? 'Active 1 hour ago' : `Active ${hours} hours ago`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
      return days === 1 ? 'Active yesterday' : `Active ${days} days ago`;
    }

    return 'Active on ' + this.formatShortDateTime(lastActiveAt);
  }

  // HOW THE SESSION ENDED

  private formatEndedDetail(session: UserSessionInfo): string {
    if (session.status === 'Active') {
      return '';
    }

    const reason =
      session.status === 'Expired' ? 'Session expired'
        : session.logoutReason === 'LoggedOutRemotely' ? 'Logged out from another device'
          : session.logoutReason === 'PasswordReset' ? 'Logged out after password reset'
            : session.logoutReason === 'SignedOut' ? 'Logged out on this device'
              : 'Logged out';

    // OLDER SESSIONS HAVE NO END TIME

    return session.endedAt
      ? `${reason} · ${this.formatShortDateTime(session.endedAt)}`
      : reason;
  }

  private formatShortDateTime(value: string): string {
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  // IP TO DISPLAY TEXT

  private formatLocation(ipAddress: string | null): string {
    if (!ipAddress) {
      return 'Unknown location';
    }

    if (
      ipAddress === '::1' ||
      ipAddress === '127.0.0.1' ||
      ipAddress === '::ffff:127.0.0.1'
    ) {
      return 'Localhost';
    }

    return ipAddress.replace('::ffff:', '');
  }

  toggleCurrentPassword(): void {
    this.showCurrentPassword = !this.showCurrentPassword;
  }

  toggleNewPassword(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  updatePassword(): void {
    this.passwordError = '';
    this.passwordSuccess = '';

    if (!this.currentPassword.trim()) {
      this.passwordError = 'Please enter your current password.';
      return;
    }

    if (!this.newPassword.trim()) {
      this.passwordError = 'Please enter a new password.';
      return;
    }

    if (this.newPassword.length < 8) {
      this.passwordError =
        'Your new password must be at least 8 characters.';
      return;
    }

    if (!/[A-Z]/.test(this.newPassword)) {
      this.passwordError =
        'Your new password must include at least one uppercase letter.';
      return;
    }

    if (!/[a-z]/.test(this.newPassword)) {
      this.passwordError =
        'Your new password must include at least one lowercase letter.';
      return;
    }

    if (!/[0-9]/.test(this.newPassword)) {
      this.passwordError =
        'Your new password must include at least one number.';
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>\_\\-`\~+=;]/.test(this.newPassword)) {
      this.passwordError =
        'Your new password must include at least one special character.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'New passwords do not match.';
      return;
    }

    if (this.currentPassword === this.newPassword) {
      this.passwordError =
        'Your new password must be different from your current password.';
      return;
    }

    this.isUpdatingPassword = true;

    this.userService.changePassword({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword,
      confirmNewPassword: this.confirmPassword
    }).subscribe({
      next: (response) => {
        this.isUpdatingPassword = false;

        this.passwordSuccess =
          response?.message ??
          'Your password has been updated successfully.';

        this.passwordChangedAt = new Date().toISOString();

        this.clearPasswordFields();
      },

      error: (error) => {
        this.isUpdatingPassword = false;

        this.passwordError =
          error.error?.message ??
          'Unable to update your password.';
      }
    });
  }

  private clearPasswordFields(): void {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';

    this.showCurrentPassword = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
  }

  // TWO-FACTOR

  loadTwoFactorSetting(): void {
    this.userService.getCurrentUser().subscribe({
      next: (user) => {
        this.twoFactorEnabled = user.twoFactorEnabled;
        this.hasLoadedTwoFactor = true;
        this.passwordChangedAt = user.passwordChangedAt;
      },

      error: () => {
        this.twoFactorError = 'Unable to load your two-factor setting.';
      }
    });
  }

  toggleTwoFactor(): void {
    if (this.isUpdatingTwoFactor || !this.hasLoadedTwoFactor) {
      return;
    }

    this.twoFactorError = '';
    this.twoFactorSuccess = '';

    // TURNING OFF: ASK FOR PASSWORD FIRST

    if (this.twoFactorEnabled) {
      this.disableTwoFactorPassword = '';
      this.showDisableTwoFactorPassword = false;
      this.disableTwoFactorError = '';
      this.showDisableTwoFactorDialog = true;
      return;
    }

    // TURNING ON: NO PASSWORD NEEDED

    this.saveTwoFactor(true);
  }

  toggleDisableTwoFactorPassword(): void {
    this.showDisableTwoFactorPassword = !this.showDisableTwoFactorPassword;
  }

  confirmDisableTwoFactor(): void {
    if (this.isUpdatingTwoFactor) {
      return;
    }

    if (!this.disableTwoFactorPassword) {
      this.disableTwoFactorError = 'Please enter your password.';
      return;
    }

    this.saveTwoFactor(false, this.disableTwoFactorPassword);
  }

  @HostListener('document:keydown.escape')
  closeDisableTwoFactorDialog(): void {
    if (!this.showDisableTwoFactorDialog || this.isUpdatingTwoFactor) {
      return;
    }

    this.showDisableTwoFactorDialog = false;
    this.disableTwoFactorPassword = '';
    this.disableTwoFactorError = '';
  }

  private saveTwoFactor(enabled: boolean, currentPassword?: string): void {
    this.isUpdatingTwoFactor = true;
    this.disableTwoFactorError = '';

    this.userService.updateTwoFactor(enabled, currentPassword).subscribe({
      next: (response) => {
        this.isUpdatingTwoFactor = false;
        this.twoFactorEnabled = response.twoFactorEnabled;
        this.twoFactorSuccess = response.message;

        this.showDisableTwoFactorDialog = false;
        this.disableTwoFactorPassword = '';
      },

      error: (error) => {
        this.isUpdatingTwoFactor = false;

        const message =
          error.error?.message ??
          'Unable to update two-factor authentication. Please try again.';

        // SHOW THE ERROR INSIDE THE DIALOG IF IT IS OPEN

        if (this.showDisableTwoFactorDialog) {
          this.disableTwoFactorError = message;
          this.disableTwoFactorPassword = '';
        } else {
          this.twoFactorError = message;
        }
      }
    });
  }

  // LOGOUT DIALOG

  get isSessionActionBusy(): boolean {
    return this.loggingOutSessionId !== null || this.isLoggingOutOthers;
  }

  openLogoutDialog(session: SessionRow): void {
    if (session.current || this.isSessionActionBusy) {
      return;
    }

    this.pendingLogout = { type: 'one', session };
  }

  openLogoutOthersDialog(): void {
    if (this.otherActiveSessionCount === 0 || this.isSessionActionBusy) {
      return;
    }

    this.pendingLogout = { type: 'others' };
  }

  @HostListener('document:keydown.escape')
  closeLogoutDialog(): void {
    if (!this.pendingLogout || this.isSessionActionBusy) {
      return;
    }

    this.pendingLogout = null;
  }

  // secureAccount = ALSO GO TO CHANGE PASSWORD

  confirmLogout(secureAccount = false): void {
    const pending = this.pendingLogout;

    if (!pending || this.isSessionActionBusy) {
      return;
    }

    if (pending.type === 'one') {
      this.logoutSession(pending.session, secureAccount);
    } else {
      this.logoutOtherSessions(secureAccount);
    }
  }

  // LOG OUT SESSIONS

  private logoutSession(session: SessionRow, secureAccount: boolean): void {
    this.loggingOutSessionId = session.sessionId;
    this.sessionActionError = '';

    this.userService.logoutSession(session.sessionId).subscribe({
      next: (response) => {
        this.finishSessionAction(
          response?.message ?? 'Session logged out successfully.',
          secureAccount
        );
      },

      error: (error) => {
        this.failSessionAction(
          error.error?.message ??
          'Unable to log out this session. Please try again.'
        );
      }
    });
  }

  private logoutOtherSessions(secureAccount: boolean): void {
    this.isLoggingOutOthers = true;
    this.sessionActionError = '';

    this.userService.logoutOtherSessions().subscribe({
      next: (response) => {
        this.finishSessionAction(
          response?.message ?? 'All other sessions were logged out.',
          secureAccount
        );
      },

      error: (error) => {
        this.failSessionAction(
          error.error?.message ??
          'Unable to log out your other sessions. Please try again.'
        );
      }
    });
  }

  // RESET STATE AFTER LOGOUT

  private finishSessionAction(message: string, secureAccount: boolean): void {
    this.loggingOutSessionId = null;
    this.isLoggingOutOthers = false;
    this.pendingLogout = null;

    this.showSessionsSuccess(message);
    this.loadSessions();

    if (secureAccount) {
      this.goToChangePassword();
    }
  }

  private failSessionAction(message: string): void {
    this.loggingOutSessionId = null;
    this.isLoggingOutOthers = false;
    this.pendingLogout = null;

    this.sessionActionError = message;
    this.loadSessions();
  }

  // SCROLL TO CHANGE PASSWORD

  private goToChangePassword(): void {
    this.passwordError = '';
    this.passwordSuccess = '';

    const passwordCard = document.getElementById('change-password');

    passwordCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    passwordCard
      ?.querySelector<HTMLInputElement>('input')
      ?.focus({ preventScroll: true });
  }

}