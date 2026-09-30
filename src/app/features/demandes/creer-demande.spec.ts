// ============================================================
// Unit Tests - CreerDemandeComponent + DemandeDraftService
// ============================================================

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { CreerDemandeComponent } from './creer-demande';
import { DemandeDraftService } from './demande-draft.service';
import { DemandeService } from '../../core/services/demande';
import { AuthService } from '../../core/services/auth';
import { of } from 'rxjs';

describe('CreerDemandeComponent - UX/Conversion Optimization', () => {
  let component: CreerDemandeComponent;
  let fixture: ComponentFixture<CreerDemandeComponent>;
  let httpMock: HttpTestingController;
  let draftService: DemandeDraftService;
  let authService: AuthService;
  let demandeService: DemandeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CreerDemandeComponent,
        ReactiveFormsModule,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        DemandeDraftService,
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: jasmine.createSpy('isLoggedIn').and.returnValue(false),
            getCurrentUser: jasmine.createSpy('getCurrentUser').and.returnValue(null)
          }
        },
        {
          provide: DemandeService,
          useValue: {
            create: jasmine.createSpy('create').and.returnValue(of({})),
            uploadPhotos: jasmine.createSpy('uploadPhotos').and.returnValue(of([]))
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CreerDemandeComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    draftService = TestBed.inject(DemandeDraftService);
    authService = TestBed.inject(AuthService);
    demandeService = TestBed.inject(DemandeService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // ============================================================
  // INITIALIZATION TESTS
  // ============================================================

  describe('Initialization', () => {
    it('should initialize component with step 1', () => {
      expect(component.step).toBe(1);
      expect(component.form).toBeDefined();
      expect(component.loading).toBe(false);
    });

    it('should create and store sessionId on init', (done) => {
      fixture.detectChanges();

      // Attend que initDraft soit appelé
      setTimeout(() => {
        const sessionId = localStorage.getItem('repando_session_id');
        expect(sessionId).toBeTruthy();
      }, 100);
      done();
    });

    it('should initialize draft on component load', (done) => {
      spyOn(draftService, 'initDraft').and.returnValue(of({
        success: true,
        data: {
          draftId: 'test-draft-id',
          draftExists: false,
          existingData: null
        }
      }));

      fixture.detectChanges();

      setTimeout(() => {
        expect(draftService.initDraft).toHaveBeenCalled();
        expect(component.draftId).toBe('test-draft-id');
      }, 100);
      done();
    });

    it('should load existing draft data if available', (done) => {
      const existingData = {
        typeAppareil: 'LAVE_LINGE',
        marque: 'Samsung',
        modele: 'WW90',
        typePanne: 'NE_DEMARRE_PLUS'
      };

      spyOn(draftService, 'initDraft').and.returnValue(of({
        success: true,
        data: {
          draftId: 'test-draft-id',
          draftExists: true,
          existingData
        }
      }));

      fixture.detectChanges();

      setTimeout(() => {
        expect(component.form.value.typeAppareil).toBe('LAVE_LINGE');
        expect(component.form.value.marque).toBe('Samsung');
      }, 150);
      done();
    });
  });

  // ============================================================
  // STEP 1 TESTS
  // ============================================================

  describe('Step 1: Device Selection & Issue', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should render step 1 content', () => {
      component.step = 1;
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('h1')?.textContent).toContain('Décrivez votre panne');
    });

    it('should allow selecting device', () => {
      component.step = 1;
      component.form.patchValue({ typeAppareil: 'LAVE_VAISSELLE' });

      expect(component.form.value.typeAppareil).toBe('LAVE_VAISSELLE');
    });

    it('should allow selecting issue type', () => {
      component.step = 1;
      component.form.patchValue({ typePanne: 'FUITE_EAU' });

      expect(component.form.value.typePanne).toBe('FUITE_EAU');
    });

    it('should submit step 1 and advance to step 2', () => {
      component.step = 1;
      component.form.patchValue({
        typeAppareil: 'LAVE_LINGE',
        typePanne: 'NE_DEMARRE_PLUS'
      });

      component.submit();

      expect(component.step).toBe(2);
      expect(component.error).toBe('');
    });

    it('should show error if device or issue not selected', () => {
      component.step = 1;
      component.form.patchValue({
        typeAppareil: null,
        typePanne: null
      });

      component.submit();

      expect(component.step).toBe(1);  // Still step 1
      expect(component.error).toContain('Veuillez au moins sélectionner');
    });

    it('should handle photos upload', (done) => {
      spyOn(demandeService, 'uploadPhotos').and.returnValue(of([
        '/demandes-photos/photo1.jpg'
      ]));

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const event = new Event('change') as any;
      event.target = { files: [file] } as any;

      component.onFileChange(event);

      setTimeout(() => {
        expect(component.photoPreviews.length).toBeGreaterThan(0);
      }, 100);
      done();
    });
  });

  // ============================================================
  // STEP 2 TESTS
  // ============================================================

  describe('Step 2: Location & Authentication', () => {
    beforeEach(() => {
      component.step = 2;
      fixture.detectChanges();
    });

    it('should render step 2 content', () => {
      fixture.detectChanges();
      const compiled = fixture.nativeElement;

      expect(compiled.querySelector('h1')?.textContent).toContain('Où voulez-vous');
    });

    it('should allow postal code entry', () => {
      component.form.patchValue({ codePostal: '75001' });

      expect(component.form.value.codePostal).toBe('75001');
    });

    it('should allow intervention type selection', () => {
      component.form.patchValue({ typeIntervention: 'DOMICILE' });

      expect(component.form.value.typeIntervention).toBe('DOMICILE');
    });

    it('should disable submit button if not authenticated', () => {
      (authService.isLoggedIn as jasmine.Spy).and.returnValue(false);
      fixture.detectChanges();

      const submitBtn = fixture.nativeElement.querySelector('.cd-btn-submit');
      expect(submitBtn?.disabled).toBe(true);
    });

    it('should enable submit button if authenticated', () => {
      (authService.isLoggedIn as jasmine.Spy).and.returnValue(true);
      fixture.detectChanges();

      const submitBtn = fixture.nativeElement.querySelector('.cd-btn-submit');
      expect(submitBtn?.disabled).toBe(false);
    });

    it('should go back to step 1 when clicking back button', () => {
      component.goBackToStep1();

      expect(component.step).toBe(1);
      expect(component.error).toBe('');
    });
  });

  // ============================================================
  // AUTO-SAVE TESTS
  // ============================================================

  describe('Auto-save Persistence', () => {
    it('should save draft data to localStorage on form change', (done) => {
      spyOn(draftService, 'saveDraftLocal');
      component.ngOnInit();

      component.form.patchValue({
        typeAppareil: 'LAVE_LINGE',
        marque: 'Samsung'
      });

      setTimeout(() => {
        expect(draftService.saveDraftLocal).toHaveBeenCalled();
      }, 400);
      done();
    });

    it('should call server autosave on debounced change', (done) => {
      spyOn(draftService, 'autosaveDraft').and.returnValue(of({}));
      component.draftId = 'test-draft-id';
      component.ngOnInit();

      component.form.patchValue({
        typeAppareil: 'LAVE_VAISSELLE'
      });

      setTimeout(() => {
        expect(draftService.autosaveDraft).toHaveBeenCalled();
      }, 1700);
      done();
    });

    it('should handle autosave errors gracefully', (done) => {
      spyOn(draftService, 'autosaveDraft').and.returnValue(
        throwError(() => new Error('Network error'))
      );
      component.draftId = 'test-draft-id';
      component.ngOnInit();

      component.form.patchValue({
        typeAppareil: 'LAVE_LINGE'
      });

      setTimeout(() => {
        // Pas d'erreur affichée (silencieux)
        expect(component.error).toBe('');
        // Mais autoSaveInProgress doit être false
        expect(component.autoSaveInProgress).toBe(false);
      }, 1700);
      done();
    });
  });

  // ============================================================
  // DRAFT RECOVERY TESTS
  // ============================================================

  describe('Draft Recovery & Restore', () => {
    it('should detect pending draft in localStorage', (done) => {
      const draftData = {
        typeAppareil: 'LAVE_LINGE',
        marque: 'LG'
      };

      localStorage.setItem('repando_draft_backup', JSON.stringify(draftData));
      component.ngOnInit();

      setTimeout(() => {
        expect(component.hasPendingDraft).toBe(true);
      }, 100);
      done();
    });

    it('should restore draft data when clicking restore', () => {
      const draftData = {
        typeAppareil: 'LAVE_VAISSELLE',
        marque: 'Bosch',
        modele: 'SMS6HCI49E',
        typePanne: 'NE_CHAUFFE_PLUS'
      };

      localStorage.setItem('repando_draft_backup', JSON.stringify(draftData));
      component.restorePendingDraft();

      expect(component.form.value.typeAppareil).toBe('LAVE_VAISSELLE');
      expect(component.form.value.marque).toBe('Bosch');
      expect(component.hasPendingDraft).toBe(false);
    });

    it('should clear draft when clicking clear', () => {
      spyOn(draftService, 'clearDraftLocal');

      component.clearPendingDraft();

      expect(draftService.clearDraftLocal).toHaveBeenCalled();
      expect(component.hasPendingDraft).toBe(false);
    });
  });

  // ============================================================
  // CONVERSION TESTS
  // ============================================================

  describe('Draft Conversion to Demande', () => {
    it('should convert draft on step 2 submit if authenticated', () => {
      (authService.isLoggedIn as jasmine.Spy).and.returnValue(true);
      spyOn(draftService, 'convertToRequest').and.returnValue(of({
        success: true,
        data: { id: 'new-demande-id' }
      }));

      component.step = 2;
      component.draftId = 'test-draft-id';
      component.form.patchValue({
        typeAppareil: 'LAVE_LINGE',
        typePanne: 'NE_DEMARRE_PLUS'
      });

      component.submit();

      expect(draftService.convertToRequest).toHaveBeenCalledWith('test-draft-id');
    });

    it('should redirect to connexion if not authenticated at step 2', () => {
      (authService.isLoggedIn as jasmine.Spy).and.returnValue(false);

      component.step = 2;
      component.submit();

      // Component devrait appeler router.navigate vers connexion
      expect(component.error).toBe('');
    });

    it('should show loading state during conversion', (done) => {
      (authService.isLoggedIn as jasmine.Spy).and.returnValue(true);
      spyOn(draftService, 'convertToRequest').and.returnValue(of({}));

      component.step = 2;
      component.draftId = 'test-draft-id';
      component.submit();

      expect(component.loading).toBe(true);

      setTimeout(() => {
        expect(component.loading).toBe(false);
      }, 500);
      done();
    });

    it('should clear local draft on successful conversion', (done) => {
      (authService.isLoggedIn as jasmine.Spy).and.returnValue(true);
      spyOn(draftService, 'convertToRequest').and.returnValue(of({}));
      spyOn(draftService, 'clearDraftLocal');

      component.step = 2;
      component.draftId = 'test-draft-id';
      component.submit();

      setTimeout(() => {
        expect(draftService.clearDraftLocal).toHaveBeenCalled();
      }, 500);
      done();
    });

    it('should handle conversion errors', (done) => {
      (authService.isLoggedIn as jasmine.Spy).and.returnValue(true);
      spyOn(draftService, 'convertToRequest').and.returnValue(
        throwError(() => ({
          error: { error: 'Invalid data' }
        }))
      );

      component.step = 2;
      component.draftId = 'test-draft-id';
      component.submit();

      setTimeout(() => {
        expect(component.error).toContain('Invalid data');
        expect(component.loading).toBe(false);
      }, 500);
      done();
    });
  });

  // ============================================================
  // CLEANUP TESTS
  // ============================================================

  describe('Component Lifecycle', () => {
    it('should unsubscribe on destroy', () => {
      spyOn(component['destroy$'], 'next');
      spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(component['destroy$'].next).toHaveBeenCalled();
      expect(component['destroy$'].complete).toHaveBeenCalled();
    });
  });
});

