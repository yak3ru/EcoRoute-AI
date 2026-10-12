
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges
} from '@angular/core';

@Component({
  selector: 'app-alert-popup',
  standalone: true,
  templateUrl: './alert-popup.component.html',
  styleUrl: './alert-popup.component.scss'
})
export class AlertPopupComponent implements OnChanges, OnDestroy {
  @Input() message = '';

  private timeoutId?: ReturnType<typeof setTimeout>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['message']) {
      this.clearTimer();

      if (this.message) {
        this.timeoutId = setTimeout(() => {
          this.message = '';
          this.timeoutId = undefined;
        }, 3000);
      }
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
}
