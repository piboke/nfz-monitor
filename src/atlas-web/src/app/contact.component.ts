import { Component, Input, OnChanges } from "@angular/core";
import { QueueRow } from "./models";
import { phoneContacts } from "./contact.mjs";

@Component({
  selector: "app-contact",
  standalone: true,
  template: `
    <div class="contact-actions no-print" [class.contact-compact]="compact">
      @if (contacts[0]; as phone) {
        @if (phone.href) {
          <a
            class="button primary call-button"
            [href]="phone.href"
            [attr.aria-label]="
              'Zadzwoń do: ' +
              row.provider +
              ', ' +
              row.place +
              ', ' +
              phone.label
            "
          >
            <span aria-hidden="true">☎</span> Zadzwoń
            @if (!compact) {
              <span class="call-number">{{ phone.label }}</span>
            }
          </a>
        } @else {
          <span class="contact-number">Telefon: {{ phone.label }}</span>
        }
      } @else {
        <span class="caption">NFZ nie podał numeru telefonu.</span>
      }
      <button
        class="button cancel-button"
        (click)="showCancellation = !showCancellation"
        [attr.aria-expanded]="showCancellation"
        [attr.aria-controls]="panelId"
        [attr.aria-label]="'Odwołaj wizytę: ' + row.provider + ', ' + row.place"
      >
        Odwołaj wizytę
      </button>
    </div>
    @if (showCancellation) {
      <section
        class="cancellation-info no-print"
        [id]="panelId"
        aria-label="Kontakt w sprawie odwołania wizyty"
      >
        <h3>Odwołaj wizytę telefonicznie</h3>
        <p>
          <strong>{{ row.provider }}</strong>
        </p>
        <p>{{ row.place }} · {{ row.locality }}</p>
        @if (contacts.length) {
          <p>Zadzwoń do placówki i zgłoś odwołanie wizyty.</p>
          <div class="cancellation-phones">
            @for (phone of contacts; track phone.label) {
              @if (phone.href) {
                <a
                  [href]="phone.href"
                  [attr.aria-label]="
                    'Zadzwoń w sprawie odwołania wizyty: ' + phone.label
                  "
                  >{{ phone.label }}</a
                >
              } @else {
                <strong>{{ phone.label }}</strong>
              }
            }
          </div>
          <p class="caption">
            To numer kontaktowy placówki podany przez NFZ. API NFZ nie
            udostępnia osobnego numeru do odwoływania wizyt. Samo wyświetlenie
            numeru nie odwołuje wizyty.
          </p>
        } @else {
          <p>
            NFZ nie podał numeru telefonu. Skontaktuj się z rejestracją przez
            oficjalną stronę placówki lub dane na potwierdzeniu wizyty.
          </p>
        }
      </section>
    }
  `,
})
export class ContactComponent implements OnChanges {
  @Input({ required: true }) row!: QueueRow;
  @Input() compact = false;
  showCancellation = false;
  get contacts() {
    return phoneContacts(this.row.phone);
  }
  get panelId() {
    return `cancel-${this.row.id}-${this.row.case}`;
  }
  ngOnChanges() {
    this.showCancellation = false;
  }
}
