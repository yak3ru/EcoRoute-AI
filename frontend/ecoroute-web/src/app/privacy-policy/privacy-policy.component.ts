import {
  Component,
  ElementRef,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.scss'
})
export class PrivacyPolicyComponent {

  activeSection = 1;

  @ViewChild('privacyContent')
  privacyContent!: ElementRef<HTMLDivElement>;

  @ViewChildren('privacySection')
  privacySections!: QueryList<ElementRef<HTMLElement>>;

  sections = [
    { number: 1, title: 'Scope' },
    { number: 2, title: 'Information We May Collect or Process' },
    { number: 3, title: 'Information We Do Not Intend to Collect' },
    { number: 4, title: 'Purposes of Processing' },
    { number: 5, title: 'Lawful Basis and Consent' },
    { number: 6, title: 'Data Security' },
    { number: 7, title: 'Sharing and Disclosure' },
    { number: 8, title: 'Research Data' },
    { number: 9, title: 'Data Retention' },
    { number: 10, title: 'Data Subject Rights' },
    { number: 11, title: 'Password and Account Security' },
    { number: 12, title: "Children's Privacy" },
    { number: 13, title: 'Maps and External Services' },
    { number: 14, title: 'Security Incidents' },
    { number: 15, title: 'Changes to This Policy' },
    { number: 16, title: 'Official Privacy Contact' },
    { number: 17, title: 'Acknowledgment' }
  ];

  scrollToSection(number: number): void {
    const section = this.privacySections
      .toArray()
      .find(
        item =>
          item.nativeElement.dataset['section'] === String(number)
      );

    if (!section) {
      return;
    }

    const container = this.privacyContent.nativeElement;
    const sectionElement = section.nativeElement;

    const containerTop = container.getBoundingClientRect().top;
    const sectionTop = sectionElement.getBoundingClientRect().top;

    const scrollPosition =
      container.scrollTop +
      (sectionTop - containerTop) -
      10;

    container.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });

    this.activeSection = number;
  }
}