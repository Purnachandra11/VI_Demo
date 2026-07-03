import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { ExcelReportService } from '../src/services/ExcelReportService';

describe('ExcelReportService report file generation', () => {
  const tempRoot = path.resolve(__dirname, '..', '.tmp-report-test');

  beforeEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.mkdirSync(tempRoot, { recursive: true });
    process.chdir(tempRoot);
  });

  afterEach(() => {
    process.chdir(path.resolve(__dirname, '..'));
  });

  it('keeps a single set of report files for repeated generation of the same row', async () => {
    const service = new ExcelReportService();
    const row = {
      msisdn: '9983477174',
      circle: 'ODI',
      rechargeMRP: '149',
      recharge: 'yes',
      swift: 'yes',
      inFlag: 'yes',
      viApp: 'yes',
      planBenefit: 'Test benefit',
      rechargeNotification: 'Test notification'
    };

    service.addInputRows([row]);
    (service as any).convertHTMLToPDF = async (_html: string, outputPath: string) => {
      fs.writeFileSync(outputPath, 'pdf');
    };

    const firstRun = await service.writeIndividualReport(row);
    const secondRun = await service.writeIndividualReport(row);

    const reportsDir = path.resolve('./reports');
    const files = fs.readdirSync(reportsDir).filter((file) => file.startsWith('SIM_Recharge_Report_9983477174_ODI_MRP149_'));
    const xlsxFiles = files.filter((file) => file.endsWith('.xlsx'));
    const htmlFiles = files.filter((file) => file.endsWith('.html'));
    const pdfFiles = files.filter((file) => file.endsWith('.pdf'));

    assert.equal(xlsxFiles.length, 1, 'Expected only one Excel file for the same report row');
    assert.equal(htmlFiles.length, 1, 'Expected only one HTML file for the same report row');
    assert.equal(pdfFiles.length, 1, 'Expected only one PDF file for the same report row');
    assert.equal(path.basename(firstRun.excelPath), path.basename(secondRun.excelPath));
    assert.equal(path.basename(firstRun.htmlPath), path.basename(secondRun.htmlPath));
    assert.equal(path.basename(firstRun.pdfPath), path.basename(secondRun.pdfPath));
  });
});
