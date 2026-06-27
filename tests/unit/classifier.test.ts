import { describe, it, expect } from 'vitest';
import { classifyTorrent, cleanTorrentName } from '../../src/services/classifier';

describe('Classification Engine', () => {
  it('should clean torrent names and extract years', () => {
    const case1 = cleanTorrentName('Oppenheimer.2023.2160p.WEB-DL.x265-GROUP');
    expect(case1.title).toBe('Oppenheimer');
    expect(case1.year).toBe('2023');

    const case2 = cleanTorrentName('[SubsPlease] Kimi no Na wa - 01 (1080p) [1234ABCD].mkv');
    expect(case2.title).toBe('Kimi no Na wa');

    const case3 = cleanTorrentName('Inside.Out.2.2024.1080p.BluRay.x264.DDP5.1-FGT');
    expect(case3.title).toBe('Inside Out 2');
    expect(case3.year).toBe('2024');

    const case4 = cleanTorrentName('The.Boys.S04E01.1080p.HEVC.x265-MeGusta');
    expect(case4.title).toBe('The Boys');
  });

  it('should classify Movies correctly', () => {
    const name = 'Avatar.The.Way.of.Water.2022.1080p.BluRay.x264-SPARKS';
    const files = [
      { path: 'Avatar.The.Way.of.Water.2022.1080p.BluRay.x264-SPARKS.mkv', size: 15_000_000_000 },
      { path: 'RARBG.txt', size: 150 },
    ];

    const result = classifyTorrent(name, files);
    expect(result.category).toBe('movies');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should classify TV Shows correctly', () => {
    const name1 = 'Breaking.Bad.S05.Complete.Season.1080p.BluRay.x264';
    const files1 = [
      { path: 'Season 5/Breaking.Bad.S05E01.mkv', size: 1_200_000_000 },
      { path: 'Season 5/Breaking.Bad.S05E02.mkv', size: 1_200_000_000 },
      { path: 'Season 5/Breaking.Bad.S05E03.mkv', size: 1_200_000_000 },
      { path: 'cover.jpg', size: 150_000 },
    ];

    const result1 = classifyTorrent(name1, files1);
    expect(result1.category).toBe('series');
    expect(result1.confidence).toBeGreaterThanOrEqual(0.7);

    // Test s01-s02 and nested subfolder season patterns
    const name2 = 'Severance.s100-s105.Bluray';
    const files2 = [
      { path: 'Severance/S250/Severance.S250E01.mkv', size: 1_200_000_000 },
    ];
    const result2 = classifyTorrent(name2, files2);
    expect(result2.category).toBe('series');
    expect(result2.confidence).toBeGreaterThanOrEqual(0.7);

    const case6 = cleanTorrentName('Show.Title.s10-s24.720p.Webrip');
    expect(case6.title).toBe('Show Title');
  });

  it('should classify Anime correctly', () => {
    const name = '[SubsPlease] Sousou no Frieren - 05 (1080p) [E73859B1].mkv';
    const files = [
      { path: '[SubsPlease] Sousou no Frieren - 05 (1080p) [E73859B1].mkv', size: 1_400_000_000 },
    ];

    const result = classifyTorrent(name, files);
    expect(result.category).toBe('anime');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should classify Games correctly', () => {
    const name = 'Cyberpunk 2077 v2.12-FitGirl Repack';
    const files = [
      { path: 'setup.exe', size: 2_500_000 },
      { path: 'data1.bin', size: 15_000_000_000 },
      { path: 'data2.bin', size: 15_000_000_000 },
      { path: 'Verify BIN files.bat', size: 400 },
      { path: 'bin/x64/steam_api64.dll', size: 250_000 },
    ];

    const result = classifyTorrent(name, files);
    expect(result.category).toBe('games');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should classify Linux ISOs correctly', () => {
    const name = 'ubuntu-24.04-desktop-amd64.iso';
    const files = [
      { path: 'ubuntu-24.04-desktop-amd64.iso', size: 4_300_000_000 },
    ];

    const result = classifyTorrent(name, files);
    expect(result.category).toBe('iso');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should classify Books correctly', () => {
    const name = 'Science Fiction Novels Collection EPUB';
    const files = [
      { path: 'Dune - Frank Herbert.epub', size: 1_200_000 },
      { path: 'Neuromancer - William Gibson.epub', size: 900_000 },
      { path: 'Foundation - Isaac Asimov.mobi', size: 1_500_000 },
      { path: 'index.txt', size: 400 },
    ];

    const result = classifyTorrent(name, files);
    expect(result.category).toBe('books');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should classify Music correctly', () => {
    const name = 'Daft Punk - Random Access Memories (2013) [FLAC]';
    const files = [
      { path: '01 - Give Life Back to Music.flac', size: 35_000_000 },
      { path: '02 - The Game of Love.flac', size: 42_000_000 },
      { path: 'Daft Punk.cue', size: 400 },
      { path: 'EAC.log', size: 12_000 },
      { path: 'cover.jpg', size: 300_000 },
    ];

    const result = classifyTorrent(name, files);
    expect(result.category).toBe('music');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should classify Software correctly', () => {
    const name = 'Adobe.Photoshop.2024.v25.0.Multilingual.Crack-AIO';
    const files = [
      { path: 'Photoshop_Setup.msi', size: 1_800_000_000 },
      { path: 'Crack/keygen.exe', size: 1_500_000 },
      { path: 'Instructions.txt', size: 2_000 },
    ];

    const result = classifyTorrent(name, files);
    expect(result.category).toBe('software');
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });
});
