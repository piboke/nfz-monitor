using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public sealed record Manifest(
    string SchemaVersion,
    DateTimeOffset? LastSync,
    bool Complete,
    bool National,
    string Source,
    string Scope,
    string[] Periods,
    string[] Regions,
    Shard[] Shards,
    string[] Warnings,
    int QueueCount,
    string Generation,
    int ProviderCount = 0,
    int FacilityCount = 0
);
