import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Utilisateur } from '../users/entities/user.entity';
import { Formation } from '../formations/entities/formation.entity';
import { Actualite } from '../news/entities/news-item.entity';
import { Projet } from '../projects/entities/project.entity';
import { Partenaire } from '../parteners/entities/partner.entity';
import { RessourceHumaine } from '../ressources-humaines/entities/ressource-humaine.entity';
import { Admission } from '../admissions/entities/admission.entity';
import { Message } from '../messages/entities/message.entity';
import { CacheService } from '../infrastructure/cache/cache.service';
import { CACHE_RESOURCE, CACHE_TTL } from '../infrastructure/cache/cache.constants';
import { formatDateLong } from '../common/utils/french-date.util';

export interface DashboardStats {
  totalUsers: number;
  totalFormations: number;
  totalNews: number;
  totalProjects: number;
  totalPartners: number;
  totalAdmissions: number;
  totalResources: number;

  totalContacts: number;
}

export interface Activity {
  id: number;
  user: string;
  action: string;
  time: string;
  type: 'user' | 'formation' | 'news' | 'project';

  avatar?: string | null;
}

export interface Overview {
  stats: DashboardStats;
  recentActivities: Activity[];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Utilisateur)
    private readonly userRepository: Repository<Utilisateur>,
    @InjectRepository(Formation)
    private readonly formationRepository: Repository<Formation>,
    @InjectRepository(Actualite)
    private readonly newsRepository: Repository<Actualite>,
    @InjectRepository(Projet)
    private readonly projectRepository: Repository<Projet>,
    @InjectRepository(Partenaire)
    private readonly partnerRepository: Repository<Partenaire>,
    @InjectRepository(Admission)
    private readonly admissionRepository: Repository<Admission>,
    @InjectRepository(RessourceHumaine)
    private readonly resourceRepository: Repository<RessourceHumaine>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly cacheService: CacheService,
  ) {}

  async getStats(): Promise<DashboardStats> {
    return this.cacheService.getOrSet(
      this.cacheService.viewKey(CACHE_RESOURCE.dashboard, 'stats'),
      () => this.computeStats(),
      { ttl: CACHE_TTL.SHORT, stampedeProtection: true },
    );
  }

  async getRecentActivities(): Promise<Activity[]> {
    return this.cacheService.getOrSet(
      this.cacheService.viewKey(CACHE_RESOURCE.dashboard, 'recent-activities'),
      () => this.computeRecentActivities(),
      { ttl: CACHE_TTL.SHORT },
    );
  }

  async getOverview(): Promise<Overview> {
    return this.cacheService.getOrSet(
      this.cacheService.viewKey(CACHE_RESOURCE.dashboard, 'overview'),
      async () => {
        const [stats, recentActivities] = await Promise.all([
          this.getStats(),
          this.getRecentActivities(),
        ]);
        return { stats, recentActivities };
      },
      { ttl: CACHE_TTL.SHORT },
    );
  }

  private async computeStats(): Promise<DashboardStats> {
    const [
      totalUsers,
      totalFormations,
      totalNews,
      totalProjects,
      totalPartners,
      totalAdmissions,
      totalResources,
      totalContacts,
    ] = await Promise.all([
      this.userRepository.count(),
      this.formationRepository.count(),
      this.newsRepository.count(),
      this.projectRepository.count(),
      this.partnerRepository.count(),
      this.admissionRepository.count(),
      this.resourceRepository.count(),
      this.messageRepository.count(),
    ]);

    return {
      totalUsers,
      totalFormations,
      totalNews,
      totalProjects,
      totalPartners,
      totalAdmissions,
      totalResources,
      totalContacts,
    };
  }

  private async computeRecentActivities(): Promise<Activity[]> {
    const recentUsers = await this.userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.nom', 'user.prenom', 'user.avatar', 'user.creeLe'])
      .orderBy('user.creeLe', 'DESC')
      .limit(5)
      .getMany();

    const recentNews = await this.newsRepository
      .createQueryBuilder('news')
      .select(['news.id', 'news.titre', 'news.creeLe'])
      .orderBy('news.creeLe', 'DESC')
      .limit(5)
      .getMany();

    const activities: Activity[] = [];

    recentUsers.forEach((user) => {
      activities.push({
        id: user.id,
        user: `${user.nom} ${user.prenom}`,
        action: "s'est inscrit sur la plateforme",
        time: this.formatTime(user.creeLe),
        type: 'user',
        avatar: user.avatar ?? null,
      });
    });

    recentNews.forEach((news) => {
      activities.push({
        id: news.id,
        user: 'Admin',
        action: `a publié l'article "${news.titre}"`,
        time: this.formatTime(news.creeLe),
        type: 'news',
        avatar: null,
      });
    });

    return activities.toSorted((a, b) => b.id - a.id).slice(0, 10);
  }

  private formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    if (days < 7) return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
    return formatDateLong(date);
  }
}
