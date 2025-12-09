import { PrismaClient } from '@prisma/client';
import { logger } from '../src/lib/logger';
import * as fs from 'fs';
import * as path from 'path';

// Type definitions for parsed schema
interface ModelField {
  name: string;
  type: string;
  isRelation: boolean;
  isOptional: boolean;
}

interface ParsedModel {
  name: string;
  fields: Map<string, ModelField>;
}

/**
 * Parse Prisma schema to extract model definitions with their fields
 */
function parseSchemaModels(schemaContent: string): Map<string, ParsedModel> {
  const models = new Map<string, ParsedModel>();
  
  // Match model blocks
  const modelBlockRegex = /model\s+(\w+)\s*{([^}]+)}/g;
  let modelMatch: RegExpExecArray | null;
  
  while ((modelMatch = modelBlockRegex.exec(schemaContent)) !== null) {
    const modelName = modelMatch[1];
    const modelBody = modelMatch[2];
    
    if (!modelName || !modelBody) continue;
    
    const fields = new Map<string, ModelField>();
    
    // Parse each line in the model body
    const lines = modelBody.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments, empty lines, and directives (@@)
      if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('@@')) {
        continue;
      }
      
      // Match field definitions: fieldName Type? @attributes
      const fieldMatch = trimmedLine.match(/^(\w+)\s+(\w+)(\[\])?\??/);
      if (fieldMatch && fieldMatch[1] && fieldMatch[2]) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2];
        const isArray = !!fieldMatch[3];
        const isOptional = trimmedLine.includes('?');
        
        // Determine if it's a relation (type starts with uppercase and isn't a primitive)
        const primitiveTypes = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'BigInt', 'Decimal'];
        const isRelation = !primitiveTypes.includes(fieldType) && fieldType.length > 0 && fieldType[0] === fieldType[0]?.toUpperCase();
        
        fields.set(fieldName, {
          name: fieldName,
          type: isArray ? `${fieldType}[]` : fieldType,
          isRelation,
          isOptional,
        });
      }
    }
    
    models.set(modelName, { name: modelName, fields });
  }
  
  return models;
}

/**
 * Extract all field names from all models into a flat Set for quick lookup
 */
function extractAllSchemaFields(models: Map<string, ParsedModel>): Set<string> {
  const allFields = new Set<string>();
  
  for (const model of models.values()) {
    for (const fieldName of model.fields.keys()) {
      allFields.add(fieldName);
    }
  }
  
  return allFields;
}

/**
 * Verify that router queries align with schema definitions
 */
const verifySchemaAlignment = async () => {
  logger.info('🔍 Verifying schema-router alignment...');

  const routersDir = path.join(__dirname, '../src/server/routers');
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');

  // Read schema file
  if (!fs.existsSync(schemaPath)) {
    logger.error('❌ Schema file not found at', schemaPath);
    process.exit(1);
  }
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  // Parse schema into structured models
  const models = parseSchemaModels(schemaContent);
  const allSchemaFields = extractAllSchemaFields(models);
  
  logger.info(`Found ${models.size} models in schema`, { models: Array.from(models.keys()) });

  // Check each router file
  const routerFiles = fs.readdirSync(routersDir).filter(f => f.endsWith('.ts'));
  const issues: string[] = [];

  for (const file of routerFiles) {
    const routerPath = path.join(routersDir, file);
    const routerContent = fs.readFileSync(routerPath, 'utf-8');

    // === Specific regression guard: targetWalletAddress in CopyTrading ===
    if (file === 'copyTrading.ts') {
      if (routerContent.includes('targetWalletAddress')) {
        const copyTradingModel = models.get('CopyTrading');
        if (!copyTradingModel?.fields.has('targetWalletAddress')) {
          issues.push(`${file}: References non-existent field 'targetWalletAddress' (should use traderId relation)`);
        }
      }
    }

    // === Check include blocks for valid relations ===
    const includeRegex = /include:\s*{([^}]+)}/g;
    let includeMatch: RegExpExecArray | null;
    while ((includeMatch = includeRegex.exec(routerContent)) !== null) {
      const includeBlock = includeMatch[1];
      if (includeBlock) {
        // Extract relation names from include block
        const relationNames = includeBlock.match(/(\w+)\s*:/g)?.map(r => r.replace(/\s*:/, '')) || [];
        for (const rel of relationNames) {
          // Skip special Prisma keywords
          if (rel === '_count' || rel === 'select' || rel === 'include' || rel === 'where' || rel === 'orderBy') {
            continue;
          }
          // Check if this relation exists in any model
          if (!allSchemaFields.has(rel)) {
            issues.push(`${file}: Includes potentially non-existent relation '${rel}'`);
          }
        }
      }
    }

    // === Check CopyTrading model field usage ===
    if (file === 'copyTrading.ts' || file === 'portfolio.ts') {
      const copyTradingModel = models.get('CopyTrading');
      const positionModel = models.get('Position');
      
      if (copyTradingModel) {
        // Check for prisma.copyTrading calls and validate field references
        const copyTradingCallRegex = /prisma\.copyTrading\.(findMany|findFirst|findUnique|update|create|delete)\s*\(\s*{([^}]+(?:{[^}]*}[^}]*)*)}/g;
        let ctMatch: RegExpExecArray | null;
        while ((ctMatch = copyTradingCallRegex.exec(routerContent)) !== null) {
          const callBody = ctMatch[2];
          if (callBody) {
            // Check where clause fields
            const whereMatch = callBody.match(/where:\s*{([^}]+)}/);
            if (whereMatch && whereMatch[1]) {
              const whereFields = whereMatch[1].match(/(\w+)\s*:/g)?.map(f => f.replace(/\s*:/, '')) || [];
              for (const field of whereFields) {
                if (!copyTradingModel.fields.has(field) && field !== 'AND' && field !== 'OR' && field !== 'NOT') {
                  issues.push(`${file}: CopyTrading query references non-existent field '${field}' in where clause`);
                }
              }
            }
          }
        }
      }
      
      // === Check Position.status usage consistency ===
      if (positionModel) {
        // Position.status is defined as String @default("OPEN") - verify string usage
        const statusField = positionModel.fields.get('status');
        if (statusField && statusField.type === 'String') {
          // Validate that status is used as string literal (correct usage)
          // Pattern: status: 'OPEN' or status: "OPEN" - this is correct
          // We just verify the field exists and is used consistently
          
          // Check for incorrect enum reference (e.g., PositionStatus.OPEN)
          if (routerContent.includes('PositionStatus.')) {
            issues.push(`${file}: Position.status is a String field, not an enum. Use string literals like 'OPEN' instead of PositionStatus.OPEN`);
          }
        }
      }
    }

    // === Check orderBy fields exist ===
    const orderByRegex = /orderBy:\s*{?\s*(\w+):/g;
    let orderByMatch: RegExpExecArray | null;
    while ((orderByMatch = orderByRegex.exec(routerContent)) !== null) {
      const orderField = orderByMatch[1];
      if (orderField && !allSchemaFields.has(orderField)) {
        issues.push(`${file}: orderBy references potentially non-existent field '${orderField}'`);
      }
    }
  }

  // Test critical queries against actual database
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();

    // Test 1: CopyTrading unique constraint (userId + traderId)
    logger.info('Testing CopyTrading unique constraint (userId + traderId)...');
    await prisma.copyTrading.findMany({
      where: { userId: 'test-user-id' },
      include: { trader: true, positions: true },
    });
    logger.info('✅ CopyTrading query structure valid');

    // Test 2: Position query with composite index and string status
    logger.info('Testing Position query with status filter...');
    await prisma.position.findMany({
      where: { status: 'OPEN' },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    });
    logger.info('✅ Position query structure valid');

    // Test 3: Portfolio snapshot range query
    logger.info('Testing PortfolioSnapshot range query...');
    await prisma.portfolioSnapshot.findMany({
      where: {
        userId: 'test-user-id',
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { timestamp: 'asc' },
    });
    logger.info('✅ PortfolioSnapshot query structure valid');

    // Test 4: CopyTrading with trader relation
    logger.info('Testing CopyTrading trader relation...');
    await prisma.copyTrading.findFirst({
      where: { isActive: true },
      include: {
        trader: {
          select: {
            walletAddress: true,
            username: true,
            totalROI: true,
          },
        },
      },
    });
    logger.info('✅ CopyTrading trader relation valid');

    await prisma.$disconnect();
  } catch (error: any) {
    logger.error('❌ Query structure test failed', { error: error.message });
    issues.push(`Query test failed: ${error.message}`);
    await prisma.$disconnect();
  }

  // Report results
  if (issues.length > 0) {
    logger.error('❌ Schema alignment issues found:', { count: issues.length, issues });
    process.exit(1);
  } else {
    logger.info('✅ Schema-router alignment verified successfully');
    process.exit(0);
  }
};

verifySchemaAlignment();
