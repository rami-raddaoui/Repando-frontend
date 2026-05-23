import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MessagerieService } from '../../core/services/messagerie';
import { DemandeService } from '../../core/services/demande';
import { AuthService } from '../../core/services/auth';
import { MessageDto, MatchingDto, TypeMessage } from '../../core/models/models';

@Component({
  selector: 'app-messagerie',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './messagerie.html',
  styleUrl: './messagerie.scss'
})
export class MessagerieComponent implements OnInit, OnDestroy {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  matchings: MatchingDto[] = [];
  messages: MessageDto[] = [];
  activeMatchingId: string | null = null;
  newMessage = '';
  loading = false;
  readonly TypeMessage = TypeMessage;

  constructor(
    private route: ActivatedRoute,
    public auth: AuthService,
    public messagerieService: MessagerieService,
    private demandeService: DemandeService,
  ) {}

  ngOnInit(): void {
    this.loadMatchings();

    // Route /messagerie/:matchingId
    const matchingId = this.route.snapshot.paramMap.get('matchingId');
    if (matchingId) this.openConversation(matchingId);

    this.messagerieService.messages$.subscribe(msgs => {
      this.messages = msgs;
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }

  ngOnDestroy(): void {
    this.messagerieService.disconnectHub();
  }

  loadMatchings(): void {
    this.demandeService.getMyMatchings().subscribe({
      next: m => this.matchings = m,
      error: () => {}
    });
  }

  openConversation(matchingId: string): void {
    if (this.activeMatchingId === matchingId) return;
    this.messagerieService.disconnectHub();
    this.activeMatchingId = matchingId;
    this.loading = true;

    this.messagerieService.getMessages(matchingId).subscribe({
      next: msgs => {
        this.messagerieService.setMessages(msgs);
        this.loading = false;
        setTimeout(() => this.scrollToBottom(), 50);
      },
      error: () => this.loading = false
    });

    this.messagerieService.connectHub(matchingId);

    // Marquer comme vu si réparateur
    if (this.auth.isReparateur()) {
      this.demandeService.marquerVu(matchingId).subscribe();
    }
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.activeMatchingId) return;
    const text = this.newMessage;
    this.newMessage = '';
    this.messagerieService.sendMessage(this.activeMatchingId, {
      contenu: text,
      type: TypeMessage.TEXTE
    }).subscribe();
  }

  isOwn(msg: MessageDto): boolean {
    return msg.senderId === this.auth.currentUser()?.userId;
  }

  private scrollToBottom(): void {
    this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
  }
}
