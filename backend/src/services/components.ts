import { query, cache } from '../database/connection';
import { cacheKeys, config } from '../config';
import { logger } from '../utils/logger';
import { Component, ApiResponse } from '../types';

export class ComponentService {

  async searchComponents(searchQuery: string, filters?: {
    category?: string;
    manufacturer?: string;
    voltageRange?: { min: number; max: number };
    protocols?: string[];
    maxPrice?: number;
  }): Promise<Component[]> {
    try {
      // Build cache key
      const cacheKey = cacheKeys.search(JSON.stringify({ query: searchQuery, filters }));

      // Check cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build SQL query
      let sql = `
        SELECT * FROM components
        WHERE (
          name ILIKE $1 OR
          description ILIKE $1 OR
          manufacturer ILIKE $1 OR
          $1 = ANY(tags)
        )
      `;

      const params: any[] = [`%${searchQuery}%`];
      let paramCount = 1;

      // Add filters
      if (filters?.category) {
        paramCount++;
        sql += ` AND category ILIKE $${paramCount}`;
        params.push(`%${filters.category}%`);
      }

      if (filters?.manufacturer) {
        paramCount++;
        sql += ` AND manufacturer ILIKE $${paramCount}`;
        params.push(`%${filters.manufacturer}%`);
      }

      if (filters?.maxPrice) {
        paramCount++;
        sql += ` AND (price IS NULL OR price <= $${paramCount})`;
        params.push(filters.maxPrice);
      }

      if (filters?.protocols?.length) {
        paramCount++;
        sql += ` AND specifications->>'communication' ILIKE ANY($${paramCount})`;
        params.push(filters.protocols.map(p => `%${p}%`));
      }

      // Add ordering and limit
      sql += ` ORDER BY
        CASE
          WHEN name ILIKE $1 THEN 1
          WHEN manufacturer ILIKE $1 THEN 2
          WHEN description ILIKE $1 THEN 3
          ELSE 4
        END,
        created_at DESC
        LIMIT 50
      `;

      const result = await query(sql, params);
      const components = result.rows;

      // Cache results
      await cache.set(cacheKey, JSON.stringify(components), config.cache.ttlSeconds);

      logger.info(`Component search completed`, {
        query: searchQuery,
        filters,
        resultCount: components.length,
      });

      return components;

    } catch (error) {
      logger.error('Component search failed:', error);
      throw error;
    }
  }

  async getComponent(componentId: string): Promise<Component | null> {
    try {
      const cacheKey = cacheKeys.component(componentId);

      // Check cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await query(
        'SELECT * FROM components WHERE id = $1',
        [componentId]
      );

      const component = result.rows[0] || null;

      if (component) {
        await cache.set(cacheKey, JSON.stringify(component), config.cache.ttlSeconds);
      }

      return component;

    } catch (error) {
      logger.error('Get component failed:', error);
      throw error;
    }
  }

  async getComponentsByCategory(category: string, limit: number = 20): Promise<Component[]> {
    try {
      const cacheKey = `category:${category}:${limit}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const result = await query(
        'SELECT * FROM components WHERE category ILIKE $1 ORDER BY created_at DESC LIMIT $2',
        [`%${category}%`, limit]
      );

      const components = result.rows;
      await cache.set(cacheKey, JSON.stringify(components), config.cache.ttlSeconds);

      return components;

    } catch (error) {
      logger.error('Get components by category failed:', error);
      throw error;
    }
  }

  async getComponentsByManufacturer(manufacturer: string, limit: number = 20): Promise<Component[]> {
    try {
      const result = await query(
        'SELECT * FROM components WHERE manufacturer ILIKE $1 ORDER BY created_at DESC LIMIT $2',
        [`%${manufacturer}%`, limit]
      );

      return result.rows;

    } catch (error) {
      logger.error('Get components by manufacturer failed:', error);
      throw error;
    }
  }

  async getCompatibleComponents(boardId: string, category?: string): Promise<Component[]> {
    try {
      const cacheKey = `compatible:${boardId}:${category || 'all'}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Get components that are known to be compatible
      let sql = `
        SELECT c.* FROM components c
        JOIN compatibility_cache cc ON c.id = cc.component_id
        WHERE cc.board_id = $1 AND cc.compatible = true
      `;

      const params: any[] = [boardId];

      if (category) {
        sql += ` AND c.category ILIKE $2`;
        params.push(`%${category}%`);
      }

      sql += ` ORDER BY cc.score DESC, c.created_at DESC LIMIT 50`;

      const result = await query(sql, params);
      const components = result.rows;

      await cache.set(cacheKey, JSON.stringify(components), config.cache.ttlSeconds);

      return components;

    } catch (error) {
      logger.error('Get compatible components failed:', error);
      throw error;
    }
  }

  async getProjectRecommendations(projectType: string, difficulty?: string): Promise<any[]> {
    try {
      const cacheKey = cacheKeys.project(`${projectType}:${difficulty || 'all'}`);
      const cached = await cache.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Get projects and their required components
      let sql = `
        SELECT p.*,
               array_agg(c.*) as component_details
        FROM projects p
        LEFT JOIN components c ON c.name = ANY(p.components)
        WHERE p.tags && $1
      `;

      const params: any[] = [[projectType]];

      if (difficulty) {
        sql += ` AND p.difficulty = $2`;
        params.push(difficulty);
      }

      sql += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT 20`;

      const result = await query(sql, params);
      const projects = result.rows;

      await cache.set(cacheKey, JSON.stringify(projects), config.cache.ttlSeconds);

      return projects;

    } catch (error) {
      logger.error('Get project recommendations failed:', error);
      throw error;
    }
  }

  async getPopularComponents(limit: number = 10): Promise<Component[]> {
    try {
      const cacheKey = `popular:${limit}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Get components that appear in many compatibility checks (proxy for popularity)
      const result = await query(`
        SELECT c.*, COUNT(cc.id) as compatibility_checks
        FROM components c
        LEFT JOIN compatibility_cache cc ON c.id = cc.component_id
        WHERE c.availability != 'discontinued'
        GROUP BY c.id
        ORDER BY compatibility_checks DESC, c.created_at DESC
        LIMIT $1
      `, [limit]);

      const components = result.rows;
      await cache.set(cacheKey, JSON.stringify(components), config.cache.ttlSeconds);

      return components;

    } catch (error) {
      logger.error('Get popular components failed:', error);
      throw error;
    }
  }

  async addComponent(component: Omit<Component, 'id' | 'createdAt' | 'updatedAt'>): Promise<Component> {
    try {
      const result = await query(`
        INSERT INTO components (
          name, manufacturer, category, description,
          specifications, compatibility, datasheet_url,
          image_url, price, availability, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        component.name,
        component.manufacturer,
        component.category,
        component.description,
        JSON.stringify(component.specifications),
        JSON.stringify(component.compatibility),
        component.datasheetUrl,
        component.imageUrl,
        component.price,
        component.availability,
        component.tags,
      ]);

      const newComponent = result.rows[0];

      // Invalidate relevant caches
      await this.invalidateCaches(newComponent);

      logger.info('Component added successfully', {
        id: newComponent.id,
        name: newComponent.name,
        category: newComponent.category,
      });

      return newComponent;

    } catch (error) {
      logger.error('Add component failed:', error);
      throw error;
    }
  }

  async updateComponent(id: string, updates: Partial<Component>): Promise<Component | null> {
    try {
      const setClause = [];
      const values = [];
      let paramCount = 0;

      // Build dynamic update query
      const allowedFields = [
        'name', 'manufacturer', 'category', 'description',
        'specifications', 'compatibility', 'datasheet_url',
        'image_url', 'price', 'availability', 'tags'
      ];

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
          paramCount++;
          setClause.push(`${key} = $${paramCount}`);
          values.push(key === 'specifications' || key === 'compatibility' ? JSON.stringify(value) : value);
        }
      }

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(id);
      const sql = `
        UPDATE components
        SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount + 1}
        RETURNING *
      `;

      const result = await query(sql, values);
      const updatedComponent = result.rows[0];

      if (updatedComponent) {
        // Clear cache
        await cache.del(cacheKeys.component(id));
        await this.invalidateCaches(updatedComponent);
      }

      return updatedComponent || null;

    } catch (error) {
      logger.error('Update component failed:', error);
      throw error;
    }
  }

  async deleteComponent(id: string): Promise<boolean> {
    try {
      const result = await query('DELETE FROM components WHERE id = $1', [id]);

      if (result.rowCount && result.rowCount > 0) {
        await cache.del(cacheKeys.component(id));
        return true;
      }

      return false;

    } catch (error) {
      logger.error('Delete component failed:', error);
      throw error;
    }
  }

  async getComponentStats(): Promise<{
    totalComponents: number;
    componentsByCategory: { [category: string]: number };
    componentsByManufacturer: { [manufacturer: string]: number };
    recentlyAdded: number;
  }> {
    try {
      // Total components
      const totalResult = await query('SELECT COUNT(*) as count FROM components');
      const totalComponents = parseInt(totalResult.rows[0].count, 10);

      // By category
      const categoryResult = await query(`
        SELECT category, COUNT(*) as count
        FROM components
        GROUP BY category
        ORDER BY count DESC
        LIMIT 20
      `);
      const componentsByCategory = categoryResult.rows.reduce((acc: any, row: any) => {
        acc[row.category] = parseInt(row.count, 10);
        return acc;
      }, {});

      // By manufacturer
      const manufacturerResult = await query(`
        SELECT manufacturer, COUNT(*) as count
        FROM components
        GROUP BY manufacturer
        ORDER BY count DESC
        LIMIT 20
      `);
      const componentsByManufacturer = manufacturerResult.rows.reduce((acc: any, row: any) => {
        acc[row.manufacturer] = parseInt(row.count, 10);
        return acc;
      }, {});

      // Recently added (last 7 days)
      const recentResult = await query(`
        SELECT COUNT(*) as count
        FROM components
        WHERE created_at > NOW() - INTERVAL '7 days'
      `);
      const recentlyAdded = parseInt(recentResult.rows[0].count, 10);

      return {
        totalComponents,
        componentsByCategory,
        componentsByManufacturer,
        recentlyAdded,
      };

    } catch (error) {
      logger.error('Get component stats failed:', error);
      throw error;
    }
  }

  async searchComponentsAdvanced(options: {
    query?: string;
    category?: string;
    manufacturer?: string;
    voltageMin?: number;
    voltageMax?: number;
    currentMax?: number;
    protocols?: string[];
    priceMin?: number;
    priceMax?: number;
    tags?: string[];
    availability?: string[];
    sortBy?: 'name' | 'price' | 'created_at' | 'popularity';
    sortOrder?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
  }): Promise<{ components: Component[]; total: number }> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramCount = 0;

      // Text search
      if (options.query) {
        paramCount++;
        whereClause += ` AND (
          name ILIKE $${paramCount} OR
          description ILIKE $${paramCount} OR
          manufacturer ILIKE $${paramCount}
        )`;
        params.push(`%${options.query}%`);
      }

      // Category filter
      if (options.category) {
        paramCount++;
        whereClause += ` AND category ILIKE $${paramCount}`;
        params.push(`%${options.category}%`);
      }

      // Manufacturer filter
      if (options.manufacturer) {
        paramCount++;
        whereClause += ` AND manufacturer ILIKE $${paramCount}`;
        params.push(`%${options.manufacturer}%`);
      }

      // Voltage range
      if (options.voltageMin !== undefined || options.voltageMax !== undefined) {
        if (options.voltageMin !== undefined) {
          paramCount++;
          whereClause += ` AND (specifications->'voltage'->'operating'->>'max')::float >= $${paramCount}`;
          params.push(options.voltageMin);
        }
        if (options.voltageMax !== undefined) {
          paramCount++;
          whereClause += ` AND (specifications->'voltage'->'operating'->>'min')::float <= $${paramCount}`;
          params.push(options.voltageMax);
        }
      }

      // Current limit
      if (options.currentMax !== undefined) {
        paramCount++;
        whereClause += ` AND (specifications->'current'->'operating'->>'max')::float <= $${paramCount}`;
        params.push(options.currentMax);
      }

      // Price range
      if (options.priceMin !== undefined) {
        paramCount++;
        whereClause += ` AND price >= $${paramCount}`;
        params.push(options.priceMin);
      }
      if (options.priceMax !== undefined) {
        paramCount++;
        whereClause += ` AND price <= $${paramCount}`;
        params.push(options.priceMax);
      }

      // Tags
      if (options.tags?.length) {
        paramCount++;
        whereClause += ` AND tags && $${paramCount}`;
        params.push(options.tags);
      }

      // Availability
      if (options.availability?.length) {
        paramCount++;
        whereClause += ` AND availability = ANY($${paramCount})`;
        params.push(options.availability);
      }

      // Sorting
      let orderClause = 'ORDER BY ';
      switch (options.sortBy) {
        case 'name':
          orderClause += 'name';
          break;
        case 'price':
          orderClause += 'price NULLS LAST';
          break;
        case 'popularity':
          orderClause += '(SELECT COUNT(*) FROM compatibility_cache cc WHERE cc.component_id = components.id)';
          break;
        case 'created_at':
        default:
          orderClause += 'created_at';
          break;
      }
      orderClause += ` ${options.sortOrder || 'DESC'}`;

      // Pagination
      const limit = options.limit || 20;
      const offset = options.offset || 0;

      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM components ${whereClause}`;
      const countResult = await query(countSql, params);
      const total = parseInt(countResult.rows[0].count, 10);

      // Get components
      const sql = `
        SELECT * FROM components
        ${whereClause}
        ${orderClause}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);

      const result = await query(sql, params);
      const components = result.rows;

      return { components, total };

    } catch (error) {
      logger.error('Advanced component search failed:', error);
      throw error;
    }
  }

  private async invalidateCaches(component: Component): Promise<void> {
    try {
      // Invalidate category cache
      await cache.del(`category:${component.category}:20`);

      // Invalidate popular components cache
      await cache.del('popular:10');

      // Invalidate search caches (more complex, could use pattern matching)
      const searchKeys = await cache.keys('search:*');
      for (const key of searchKeys) {
        await cache.del(key);
      }

    } catch (error) {
      logger.warn('Failed to invalidate caches:', error);
    }
  }
}