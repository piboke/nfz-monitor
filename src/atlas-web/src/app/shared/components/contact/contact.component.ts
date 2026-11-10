import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
} from "@angular/core";
import { QueueRow } from "../../../core/models/dataset.models";
import { phoneContacts } from "../../formatting/contact";

@Component({
  selector: "app-contact",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./contact.component.scss",
  templateUrl: "./contact.component.html",
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
