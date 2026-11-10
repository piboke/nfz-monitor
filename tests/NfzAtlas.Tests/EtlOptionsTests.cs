using NfzAtlas.ETL;
using Xunit;

namespace NfzAtlas.Tests;

public sealed class EtlOptionsTests
{
    [Fact]
    public void DefaultsCoverEveryRegionAndBothCategories()
    {
        var options = EtlOptions.Parse([]);
        Assert.True(options.National);
        Assert.Equal(32, options.Partitions.Length);
        Assert.Equal(32, options.Partitions.Distinct().Count());
    }

    [Theory]
    [InlineData("--unknown", "x")]
    [InlineData("--province", "99")]
    [InlineData("--case", "3")]
    [InlineData("--measure", "maybe")]
    public void RejectsInvalidOptions(string key, string value) =>
        Assert.Throws<ArgumentException>(() => EtlOptions.Parse([key, value]));

    [Fact]
    public void RequiresValuesAndRejectsRepeatedKeys()
    {
        Assert.Throws<ArgumentException>(() => EtlOptions.Parse(["--data"]));
        Assert.Throws<ArgumentException>(() => EtlOptions.Parse(["--case", "1", "--case", "2"]));
    }

    [Fact]
    public void DeduplicatesScopeWithoutChangingItsMeaning()
    {
        var options = EtlOptions.Parse(["--province", "07,07", "--case", "1,1"]);
        Assert.False(options.National);
        Assert.Single(options.Partitions);
        Assert.Equal("07", options.Partitions[0].Province);
    }

    [Fact]
    public void FixtureCannotOverwriteProductionDataOrRunWithRecovery()
    {
        Assert.Throws<ArgumentException>(() => EtlOptions.Parse(["--fixture", "fixture.json"]));
        Assert.Throws<ArgumentException>(() =>
            EtlOptions.Parse([
                "--fixture",
                "fixture.json",
                "--data",
                Path.Combine(Path.GetTempPath(), "nfz-fixture"),
                "--rebuild-history",
                "true",
            ])
        );
    }
}
