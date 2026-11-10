using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public sealed record Shard(
    string Province,
    int Case,
    string BenefitId,
    string Benefit,
    string Path,
    string HistoryPath,
    int Count,
    long Bytes
);
