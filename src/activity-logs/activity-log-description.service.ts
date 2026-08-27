import { Injectable } from '@nestjs/common';

export interface DescribeActivityParams {
  module: string;
  method: string;
  action: string;
  endpoint: string;
  metadata: Record<string, unknown> | null;
}

const ENTITY_TYPE: Record<string, string> = {
  users: 'User',
  admissions: 'Admission',
  formations: 'Formation',
  projects: 'Project',
  news: 'News',
  partners: 'Partner',
  messages: 'Message',
  'ressources-humaines': 'RessourceHumaine',
  upload: 'File',
  documents: 'Document',
};

const DESCRIPTION_TEMPLATES: Record<string, Record<string, string>> = {
  users: {
    create: "Création d'un utilisateur.",
    update: "Modification d'un utilisateur.",
    delete: "Suppression d'un utilisateur.",
  },
  admissions: {
    create: "Création d'une demande d'admission.",
    update: "Modification d'une demande d'admission.",
    status: "Modification d'une demande d'admission.",
    delete: "Suppression d'une demande d'admission.",
  },
  formations: {
    create: "Création d'une formation.",
    update: "Modification d'une formation.",
    delete: "Suppression d'une formation.",
  },
  projects: {
    create: "Création d'un projet.",
    update: "Modification d'un projet.",
    delete: "Suppression d'un projet.",
  },
  news: {
    create: "Création d'une actualité.",
    update: "Modification d'une actualité.",
    delete: "Suppression d'une actualité.",
  },
  partners: {
    create: "Création d'un partenaire.",
    update: "Modification d'un partenaire.",
    delete: "Suppression d'un partenaire.",
  },
  messages: {
    create: "Création d'un message.",
    update: "Modification d'un message.",
    delete: "Suppression d'un message.",
  },
  'ressources-humaines': {
    create: "Création d'une ressource humaine.",
    update: "Modification d'une ressource humaine.",
    delete: "Suppression d'une ressource humaine.",
  },
  upload: {
    create: "Téléversement d'un fichier.",
    delete: "Suppression d'un fichier.",
  },
  documents: {
    create: "Ajout d'un document.",
    update: "Modification d'un document.",
    delete: "Suppression d'un document.",
  },
};

@Injectable()
export class ActivityLogDescriptionService {
  resolveAction(method: string, segments: string[]): string {
    const last = segments[segments.length - 1];
    if (last === 'status') {
      return 'status';
    }
    switch (method) {
      case 'POST':
        return 'create';
      case 'PUT':
      case 'PATCH':
        return 'update';
      case 'DELETE':
        return 'delete';
      default:
        return method.toLowerCase();
    }
  }

  describe(params: DescribeActivityParams): string {
    const { module, method, action, endpoint, metadata } = params;

    if (module === 'admissions' && action === 'status') {
      const status = metadata?.status;
      if (status === 'accepte') {
        return "Acceptation d'une demande d'admission.";
      }
      if (status === 'refuse') {
        return "Refus d'une demande d'admission.";
      }
    }

    const moduleTemplates = DESCRIPTION_TEMPLATES[module];
    const template = moduleTemplates?.[action];
    if (template) {
      return template;
    }

    return `Action ${method} sur ${endpoint}.`;
  }

  entityType(module: string): string {
    return ENTITY_TYPE[module] ?? module;
  }
}
